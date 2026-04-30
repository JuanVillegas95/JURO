import Editor from "@monaco-editor/react";
import { ComponentProps, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Code2,
  Copy,
  Eraser,
  Expand,
  FileImage,
  Italic,
  Link2,
  List,
  ListOrdered,
  Lock,
  Plus,
  Settings,
  Tag,
  Underline,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import remarkGfm from "remark-gfm";
import { createProblem, createSubmission, getProblem, listProblems } from "./api";
import type {
  ProblemDetail,
  ProblemDifficulty,
  ProblemExample,
  ProblemRequest,
  ProblemSummary,
  ProblemType,
  Submission,
} from "./types";

const defaultProblemForm = (): ProblemRequest => ({
  title: "",
  slug: "",
  summary: "",
  descriptionMarkdown: "",
  constraintsMarkdown: "",
  type: "JAVA",
  difficulty: "EASY",
  starterCode: "",
  referenceSolution: "",
  evaluationNotes: "",
  examples: [
    {
      label: "Example 1",
      sortOrder: 0,
      inputData: "",
      expectedOutput: "",
      explanation: "",
    },
  ],
});

type DocumentTab = "description" | "solution" | "notes";
type AuthorSection = "setup" | "prompt" | "judge" | "examples";
type CodeLanguage = "java" | "sql" | "json" | "plaintext";
type ResultPanelMode = "testcase" | "result";

type MonacoBeforeMount = NonNullable<ComponentProps<typeof Editor>["beforeMount"]>;
type Monaco = Parameters<MonacoBeforeMount>[0];

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<ProblemListPage />} />
          <Route path="/problems/new" element={<CreateProblemPage />} />
          <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function getResponsivePageSize() {
  if (typeof window === "undefined") {
    return 6;
  }

  const { innerHeight, innerWidth } = window;

  if (innerWidth < 760 || innerHeight < 760) {
    return 4;
  }

  if (innerHeight < 920) {
    return 5;
  }

  return 6;
}

function useResponsivePageSize() {
  const [pageSize, setPageSize] = useState(getResponsivePageSize);

  useEffect(() => {
    function handleResize() {
      setPageSize(getResponsivePageSize());
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return pageSize;
}

type ScreenHeaderProps = {
  kicker: string;
  title: string;
  description: string;
  compact?: boolean;
  children?: ReactNode;
};

function ScreenHeader({ kicker, title, description, compact = false, children }: ScreenHeaderProps) {
  return (
    <header className={`screen-header glass-panel${compact ? " screen-header--compact" : ""}`}>
      <div className="screen-header__main">
        <div className="screen-header__copy">
          <p className="section-kicker">{kicker}</p>
          <h1 className="screen-header__title">{title}</h1>
          <p className="screen-header__description">{description}</p>
        </div>
        <PrimaryNav />
      </div>
      {children ? <div className="screen-header__extras">{children}</div> : null}
    </header>
  );
}

function PrimaryNav({ variant = "panel" }: { variant?: "panel" | "tabs" }) {
  const location = useLocation();
  const authorSelected = location.pathname === "/problems/new";
  const navClassName = variant === "tabs" ? "primary-nav primary-nav--tabs" : "primary-nav glass-panel";

  return (
    <nav aria-label="Primary" className={navClassName}>
      <Link className={`primary-nav__link${!authorSelected ? " primary-nav__link--active" : ""}`} to="/">
        Browse Problems
      </Link>
      <Link className={`primary-nav__link${authorSelected ? " primary-nav__link--active" : ""}`} to="/problems/new">
        Author Problems
      </Link>
    </nav>
  );
}

type ProblemTrack = "Algorithms" | "Data";
type CatalogStatus = "SOLVED" | "ATTEMPTED" | "NOT_STARTED";
type SortKey = "status" | "title" | "language" | "difficulty" | "avgTime" | "updated";
type SortDirection = "asc" | "desc";
type SortPreset = "UPDATED_DESC" | "TITLE_ASC" | "DIFFICULTY_ASC" | "AVG_TIME_ASC" | "CUSTOM";

type CatalogProblem = ProblemSummary & {
  avgTimeMinutes: number | null;
  displayTitle: string;
  status: CatalogStatus;
  track: ProblemTrack;
};

const problemBankDisplayTotal = 142;

const statusMeta: Record<CatalogStatus, { label: string; mark: string }> = {
  SOLVED: { label: "Solved", mark: "●" },
  ATTEMPTED: { label: "Attempted", mark: "◐" },
  NOT_STARTED: { label: "Not started", mark: "○" },
};

const statusRank: Record<CatalogStatus, number> = {
  SOLVED: 0,
  ATTEMPTED: 1,
  NOT_STARTED: 2,
};

const difficultyRank: Record<ProblemDifficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

function hashString(value: string) {
  return Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0);
}

function displayDifficulty(value: ProblemDifficulty) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function displayLanguage(value: ProblemType) {
  return value === "SQL" ? "SQL" : "JAVA";
}

function trackForProblem(problem: ProblemSummary): ProblemTrack {
  return problem.type === "SQL" ? "Data" : "Algorithms";
}

function statusForProblem(problem: ProblemSummary): CatalogStatus {
  const seed = hashString(problem.slug);

  if (problem.slug.includes("two-sum") || problem.slug.includes("merge-intervals") || seed % 6 === 0) {
    return "SOLVED";
  }

  if (problem.slug.includes("valid-parentheses") || seed % 4 === 0) {
    return "ATTEMPTED";
  }

  return "NOT_STARTED";
}

function averageTimeForProblem(problem: ProblemSummary) {
  const seed = hashString(problem.id);

  if (problem.difficulty === "HARD" || seed % 7 === 0) {
    return null;
  }

  const baseTime: Record<ProblemDifficulty, number> = {
    EASY: 14,
    MEDIUM: 24,
    HARD: 38,
  };

  return baseTime[problem.difficulty] + (seed % 9);
}

function displayProblemTitle(title: string) {
  return title.replace(/\s+Lite$/i, "");
}

function formatAvgTime(value: number | null) {
  return value === null ? "—" : `${value} min`;
}

function formatCatalogDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const daysAgo = Math.floor((today.getTime() - dateOnly.getTime()) / 86_400_000);

  if (daysAgo <= 0) {
    return "Today";
  }

  if (daysAgo === 1) {
    return "Yesterday";
  }

  if (daysAgo < 7) {
    return `${daysAgo} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function defaultDirectionForSort(key: SortKey): SortDirection {
  return key === "updated" ? "desc" : "asc";
}

function sortPresetForConfig(key: SortKey, direction: SortDirection): SortPreset {
  if (key === "updated" && direction === "desc") {
    return "UPDATED_DESC";
  }

  if (key === "title" && direction === "asc") {
    return "TITLE_ASC";
  }

  if (key === "difficulty" && direction === "asc") {
    return "DIFFICULTY_ASC";
  }

  if (key === "avgTime" && direction === "asc") {
    return "AVG_TIME_ASC";
  }

  return "CUSTOM";
}

function configForSortPreset(value: SortPreset): { key: SortKey; direction: SortDirection } | null {
  switch (value) {
    case "UPDATED_DESC":
      return { key: "updated", direction: "desc" };
    case "TITLE_ASC":
      return { key: "title", direction: "asc" };
    case "DIFFICULTY_ASC":
      return { key: "difficulty", direction: "asc" };
    case "AVG_TIME_ASC":
      return { key: "avgTime", direction: "asc" };
    case "CUSTOM":
      return null;
  }
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareCatalogProblems(left: CatalogProblem, right: CatalogProblem, key: SortKey, direction: SortDirection) {
  let comparison = 0;

  if (key === "status") {
    comparison = statusRank[left.status] - statusRank[right.status];
  }

  if (key === "title") {
    comparison = compareStrings(left.displayTitle, right.displayTitle);
  }

  if (key === "language") {
    comparison = compareStrings(left.type, right.type);
  }

  if (key === "difficulty") {
    comparison = difficultyRank[left.difficulty] - difficultyRank[right.difficulty];
  }

  if (key === "avgTime") {
    const leftTime = left.avgTimeMinutes ?? Number.POSITIVE_INFINITY;
    const rightTime = right.avgTimeMinutes ?? Number.POSITIVE_INFINITY;
    comparison = leftTime - rightTime;
  }

  if (key === "updated") {
    comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
  }

  if (comparison === 0) {
    return compareStrings(left.displayTitle, right.displayTitle);
  }

  return direction === "asc" ? comparison : -comparison;
}

function paginationItems(totalPages: number, activePage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  if (activePage <= 2) {
    return [0, 1, 2, "ellipsis", totalPages - 2, totalPages - 1] as const;
  }

  if (activePage >= totalPages - 3) {
    return [0, 1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1] as const;
  }

  return [0, "ellipsis-start", activePage - 1, activePage, activePage + 1, "ellipsis-end", totalPages - 1] as const;
}

type ProblemMetaTagsProps = {
  difficulty: ProblemDifficulty;
  type: ProblemType;
  exampleCount?: number;
};

function ProblemMetaTags({ difficulty, type, exampleCount }: ProblemMetaTagsProps) {
  return (
    <div className="meta-tags">
      <span className={`tag tag--${type.toLowerCase()}`}>{type}</span>
      <span className={`tag tag--${difficulty.toLowerCase()}`}>{difficulty}</span>
      {exampleCount !== undefined ? <span className="tag tag--neutral">{exampleCount} examples</span> : null}
    </div>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function editorLanguageFor(type: ProblemType) {
  return type === "SQL" ? "sql" : "java";
}

function parseStructuredInput(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function formatInlineValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="markdown-block">
      <ReactMarkdown
        components={{
          code({ children, className }) {
            const isBlock = (className ?? "").includes("language-");
            if (isBlock) {
              return (
                <pre className="markdown-block__code">
                  <code>{children}</code>
                </pre>
              );
            }

            return <code className="markdown-block__inline">{children}</code>;
          },
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ExamplePresentation({ example, problemType }: { example: ProblemExample; problemType: ProblemType }) {
  const structuredInput = parseStructuredInput(example.inputData);
  const inlineExpected = example.expectedOutput.split(/\r?\n/).length <= 3 && example.expectedOutput.length <= 120;

  return (
    <article className="leetcode-example">
      <h4>{example.label}</h4>

      {structuredInput ? (
        <div className="leetcode-example__row">
          <span className="leetcode-example__label">Input:</span>
          <div className="leetcode-example__inline-values">
            {Object.entries(structuredInput).map(([key, value]) => (
              <span className="leetcode-example__chip" key={key}>
                <strong>{key}</strong>
                <code>{formatInlineValue(value)}</code>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="leetcode-example__stack">
          <span className="leetcode-example__label">Input:</span>
          <CodePreview
            language={problemType === "SQL" ? "sql" : "plaintext"}
            maxHeight={180}
            minHeight={96}
            value={example.inputData}
          />
        </div>
      )}

      <div className="leetcode-example__row">
        <span className="leetcode-example__label">Output:</span>
        {inlineExpected ? (
          <code className="leetcode-example__output">{formatCodeSnippet(example.expectedOutput, exampleExpectedLanguage(example.expectedOutput))}</code>
        ) : (
          <div className="leetcode-example__output-block">
            <CodePreview
              language={exampleExpectedLanguage(example.expectedOutput)}
              maxHeight={180}
              minHeight={96}
              value={example.expectedOutput}
            />
          </div>
        )}
      </div>

      {example.explanation ? (
        <div className="leetcode-example__row">
          <span className="leetcode-example__label">Explanation:</span>
          <p>{example.explanation}</p>
        </div>
      ) : null}
    </article>
  );
}

function configureMonacoTheme(monaco: Monaco) {
  monaco.editor.defineTheme("juro-liquid", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8C94A3", fontStyle: "italic" },
      { token: "keyword", foreground: "5486F7" },
      { token: "string", foreground: "1A9AA8" },
      { token: "number", foreground: "D8893B" },
    ],
    colors: {
      "editor.background": "#FBFBFD",
      "editor.lineHighlightBackground": "#F2F6FA",
      "editor.selectionBackground": "#DCEEFF",
      "editorLineNumber.foreground": "#A7AFBC",
      "editorLineNumber.activeForeground": "#586171",
      "editorCursor.foreground": "#33A4F5",
      "editorGutter.background": "#FBFBFD",
    },
  });
}

function looksLikeJson(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("{")
    || trimmed.startsWith("[")
    || trimmed.startsWith("\"")
    || trimmed === "true"
    || trimmed === "false"
    || trimmed === "null"
    || /^-?\d+(\.\d+)?$/.test(trimmed);
}

function formatCodeSnippet(value: string, language: CodeLanguage) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (language === "json" && looksLikeJson(trimmed)) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }

  return value;
}

function codePreviewHeight(value: string, minimum = 104, maximum = 220) {
  const lineCount = Math.max(1, value.split(/\r?\n/).length);
  return `${Math.min(maximum, Math.max(minimum, lineCount * 20 + 22))}px`;
}

function exampleInputLanguage(problemType: ProblemType): CodeLanguage {
  return problemType === "SQL" ? "sql" : "json";
}

function exampleExpectedLanguage(value: string): CodeLanguage {
  return looksLikeJson(value) ? "json" : "plaintext";
}

function isCompactValue(value: string) {
  return value.split(/\r?\n/).length <= 2 && value.length <= 80;
}

type CodePreviewProps = {
  value: string;
  language: CodeLanguage;
  minHeight?: number;
  maxHeight?: number;
};

function CodePreview({ value, language, minHeight = 104, maxHeight = 220 }: CodePreviewProps) {
  const normalized = formatCodeSnippet(value, language);

  return (
    <div className="code-preview">
      <Editor
        beforeMount={configureMonacoTheme}
        height={codePreviewHeight(normalized, minHeight, maxHeight)}
        language={language}
        options={{
          automaticLayout: true,
          domReadOnly: true,
          fontFamily: "Chakra Petch, monospace",
          fontLigatures: true,
          fontSize: 11,
          glyphMargin: false,
          lineHeight: 18,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          padding: { top: 10, bottom: 10 },
          readOnly: true,
          renderLineHighlight: "none",
          scrollBeyondLastLine: false,
          scrollbar: {
            alwaysConsumeMouseWheel: false,
            horizontalScrollbarSize: 6,
            verticalScrollbarSize: 6,
          },
          wordWrap: "on",
        }}
        theme="juro-liquid"
        value={normalized}
      />
    </div>
  );
}

function ProblemListPage() {
  const pageSize = useResponsivePageSize();
  const [pageIndex, setPageIndex] = useState(0);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [isEditProblemOpen, setIsEditProblemOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<ProblemTrack | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<ProblemDifficulty | "ALL">("ALL");
  const [languageFilter, setLanguageFilter] = useState<ProblemType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<CatalogStatus | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const response = await listProblems();
        if (active) {
          setProblems(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load problems.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const catalogProblems: CatalogProblem[] = problems.map((problem) => ({
    ...problem,
    avgTimeMinutes: averageTimeForProblem(problem),
    displayTitle: displayProblemTitle(problem.title),
    status: statusForProblem(problem),
    track: trackForProblem(problem),
  }));

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredProblems = catalogProblems.filter((problem) => {
    const matchesTrack = trackFilter === "ALL" || problem.track === trackFilter;
    const matchesDifficulty = difficultyFilter === "ALL" || problem.difficulty === difficultyFilter;
    const matchesLanguage = languageFilter === "ALL" || problem.type === languageFilter;
    const matchesStatus = statusFilter === "ALL" || problem.status === statusFilter;
    const searchableText = [
      problem.displayTitle,
      problem.title,
      problem.summary,
      problem.slug,
      problem.track,
      problem.type,
      problem.difficulty,
      statusMeta[problem.status].label,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);

    return matchesTrack && matchesDifficulty && matchesLanguage && matchesStatus && matchesSearch;
  });

  const sortedProblems = [...filteredProblems].sort((left, right) =>
    compareCatalogProblems(left, right, sortKey, sortDirection),
  );
  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedProblems = sortedProblems.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);
  const hasActiveFilters =
    trackFilter !== "ALL" || difficultyFilter !== "ALL" || languageFilter !== "ALL" || statusFilter !== "ALL";
  const sortSelectValue = sortPresetForConfig(sortKey, sortDirection);
  const tableHeaders: Array<{ key: SortKey; label: string; align?: "left" | "right" }> = [
    { key: "status", label: "Status" },
    { key: "title", label: "Problem" },
    { key: "language", label: "Language" },
    { key: "difficulty", label: "Difficulty" },
    { key: "avgTime", label: "Avg Time", align: "right" },
    { key: "updated", label: "Updated", align: "right" },
  ];

  useEffect(() => {
    setPageIndex(0);
  }, [difficultyFilter, languageFilter, pageSize, searchQuery, statusFilter, trackFilter]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  function handleColumnSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(defaultDirectionForSort(nextKey));
  }

  function handleSortPreset(nextValue: SortPreset) {
    const nextConfig = configForSortPreset(nextValue);

    if (!nextConfig) {
      return;
    }

    setSortKey(nextConfig.key);
    setSortDirection(nextConfig.direction);
  }

  function sortGlyph(key: SortKey) {
    if (sortKey !== key) {
      return "⇅";
    }

    return sortDirection === "asc" ? "▲" : "▼";
  }

  function clearFilters() {
    setTrackFilter("ALL");
    setDifficultyFilter("ALL");
    setLanguageFilter("ALL");
    setStatusFilter("ALL");
  }

  return (
    <section className="viewport-page viewport-page--catalog">
      <div className="catalog-shell">
        <section className="problem-bank-panel glass-panel">
          <header className="problem-bank-header">
            <div className="problem-bank-header__bar">
              <Link aria-label="Back" className="icon-button" to="/">
                ←
              </Link>
              <h1>Problem Bank</h1>
              <button aria-label="Settings" className="icon-button" type="button">
                ⚙
              </button>
            </div>
            <div className="problem-bank-header__tabs">
              <PrimaryNav variant="tabs" />
            </div>
          </header>

          <div className="catalog-toolbar">
            <label className="catalog-search">
              <span className="catalog-search__icon" aria-hidden="true" />
              <input
                aria-label="Search problems"
                placeholder="Search problems by name, tag, or topic..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <div className="catalog-count">{problemBankDisplayTotal} problems</div>
          </div>

          <div className="catalog-filters" aria-label="Problem filters">
            <label className={`filter-control${trackFilter !== "ALL" ? " filter-control--active" : ""}`}>
              <select
                aria-label="Track"
                value={trackFilter}
                onChange={(event) => setTrackFilter(event.target.value as ProblemTrack | "ALL")}
              >
                <option value="ALL">Track</option>
                <option value="Algorithms">Algorithms</option>
                <option value="Data">Data</option>
              </select>
            </label>

            <label className={`filter-control${difficultyFilter !== "ALL" ? " filter-control--active" : ""}`}>
              <select
                aria-label="Difficulty"
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value as ProblemDifficulty | "ALL")}
              >
                <option value="ALL">Difficulty</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </label>

            <label className={`filter-control${languageFilter !== "ALL" ? " filter-control--active" : ""}`}>
              <select
                aria-label="Language"
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value as ProblemType | "ALL")}
              >
                <option value="ALL">Language</option>
                <option value="JAVA">JAVA</option>
                <option value="SQL">SQL</option>
              </select>
            </label>

            <label className={`filter-control${statusFilter !== "ALL" ? " filter-control--active" : ""}`}>
              <select
                aria-label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as CatalogStatus | "ALL")}
              >
                <option value="ALL">Status</option>
                <option value="SOLVED">Solved</option>
                <option value="ATTEMPTED">Attempted</option>
                <option value="NOT_STARTED">Not started</option>
              </select>
            </label>

            <label className="filter-control filter-control--active filter-control--sort">
              <select
                aria-label="Sort problems"
                value={sortSelectValue}
                onChange={(event) => handleSortPreset(event.target.value as SortPreset)}
              >
                <option value="UPDATED_DESC">Sort by: Recently updated</option>
                <option value="TITLE_ASC">Sort by: Problem name</option>
                <option value="DIFFICULTY_ASC">Sort by: Difficulty</option>
                <option value="AVG_TIME_ASC">Sort by: Avg time</option>
                <option disabled value="CUSTOM">
                  Sort by: Custom
                </option>
              </select>
            </label>

            {hasActiveFilters ? (
              <button className="clear-filters" onClick={clearFilters} type="button">
                Clear filters
              </button>
            ) : null}
          </div>

          <section className="catalog-table" aria-label="Problems">
            <div className="catalog-table__head" role="row">
              {tableHeaders.map((header) => (
                <button
                  className={`catalog-sort catalog-sort--${header.align ?? "left"}${
                    sortKey === header.key ? " catalog-sort--active" : ""
                  }`}
                  key={header.key}
                  onClick={() => handleColumnSort(header.key)}
                  type="button"
                >
                  <span>{header.label}</span>
                  <span className="catalog-sort__glyph">{sortGlyph(header.key)}</span>
                </button>
              ))}
            </div>

            <div className="catalog-table__body">
              {isLoading ? <div className="empty-state">Loading problems…</div> : null}
              {error ? <div className="error-banner">{error}</div> : null}
              {!isLoading && !error && pagedProblems.length === 0 ? (
                <div className="empty-state">No problems match the current filters.</div>
              ) : null}

              {pagedProblems.map((problem) => (
                <Link className="catalog-row" key={problem.id} to={`/problems/${problem.id}`}>
                  <div className="catalog-row__cell catalog-row__status" data-label="Status">
                    <span className={`status-label status-label--${problem.status.toLowerCase().replace("_", "-")}`}>
                      <span className="status-label__mark" aria-hidden="true">
                        {statusMeta[problem.status].mark}
                      </span>
                      {statusMeta[problem.status].label}
                    </span>
                  </div>

                  <div className="catalog-row__cell catalog-row__problem" data-label="Problem">
                    <div className="catalog-row__text">
                      <strong>{problem.displayTitle}</strong>
                      <span>{problem.summary}</span>
                    </div>
                  </div>

                  <div className="catalog-row__cell" data-label="Language">
                    <span className={`tag tag--language tag--${problem.type.toLowerCase()}`}>
                      {displayLanguage(problem.type)}
                    </span>
                  </div>

                  <div className="catalog-row__cell" data-label="Difficulty">
                    <span className={`tag tag--difficulty tag--${problem.difficulty.toLowerCase()}`}>
                      {displayDifficulty(problem.difficulty)}
                    </span>
                  </div>

                  <div
                    className={`catalog-row__cell catalog-row__cell--number${
                      problem.avgTimeMinutes === null ? " catalog-row__cell--muted" : ""
                    }`}
                    data-label="Avg Time"
                  >
                    {formatAvgTime(problem.avgTimeMinutes)}
                  </div>

                  <div className="catalog-row__cell catalog-row__cell--number catalog-row__cell--muted" data-label="Updated">
                    {formatCatalogDate(problem.updatedAt)}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <div className="catalog-pager" aria-label="Pagination">
            <button
              aria-label="Previous page"
              className="pager-arrow"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              type="button"
            >
              ‹
            </button>

            <div className="catalog-pager__pages">
              {paginationItems(totalPages, safePageIndex).map((item, index) =>
                typeof item === "string" ? (
                  <span className="pager-ellipsis" key={`${item}-${index}`}>
                    …
                  </span>
                ) : (
                  <button
                    aria-label={`Page ${item + 1}`}
                    aria-current={item === safePageIndex ? "page" : undefined}
                    className={`pager-pill${item === safePageIndex ? " pager-pill--active" : ""}`}
                    key={item}
                    onClick={() => setPageIndex(item)}
                    type="button"
                  >
                    {item + 1}
                  </button>
                ),
              )}
            </div>

            <button
              aria-label="Next page"
              className="pager-arrow"
              disabled={safePageIndex >= totalPages - 1}
              onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
              type="button"
            >
              →
            </button>
          </div>
        </section>
      </div>

      {isEditProblemOpen ? <EditProblemDrawer onClose={() => setIsEditProblemOpen(false)} /> : null}
    </section>
  );
}

type EditProblemDrawerProps = {
  onClose: () => void;
};

type TestCaseDraft = {
  input: string;
  expectedOutput: string;
  hidden: boolean;
};

function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function EditProblemDrawer({ onClose }: EditProblemDrawerProps) {
  const [title, setTitle] = useState("Climb Stairs Count");
  const [slug, setSlug] = useState("climb-stairs-count");
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [languages, setLanguages] = useState<ProblemType[]>(["JAVA"]);
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>("EASY");
  const [tags, setTags] = useState(["cho", "dynamic-programming", "recursion"]);
  const [descriptionTab, setDescriptionTab] = useState<"write" | "preview">("write");
  const [description, setDescription] = useState("You are climbing a staircase. It takes 'n' steps to reach the top.");
  const [examples, setExamples] = useState([
    {
      label: "Example 1",
      input: "n = 2",
      output: "2",
      extraOutput: "12",
      explanation: "1+1, 2",
    },
  ]);
  const [starterCode, setStarterCode] = useState("class Solution {\n    public int climbStairs(int n) {\n    }\n}");
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [referenceSolution, setReferenceSolution] = useState("class Solution {\n    public int climbStairs(int n) {\n    }\n}");
  const [testCases, setTestCases] = useState<TestCaseDraft[]>([
    { input: "1", expectedOutput: "2", hidden: false },
    { input: "", expectedOutput: "3", hidden: true },
  ]);
  const [lastSavedAt, setLastSavedAt] = useState(() => new Date(Date.now() - 2000));
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const autosaveHasMounted = useRef(false);

  const filledCompletionItems = [
    title.trim().length > 0,
    slug.trim().length > 0,
    languages.length > 0,
    Boolean(difficulty),
    tags.length > 0,
    description.trim().length > 0,
    examples.length > 1,
    starterCode.trim().length > 120,
    referenceSolution.trim().length > 120,
    testCases.length >= 3,
  ].filter(Boolean).length;
  const completionPercent = Math.round((filledCompletionItems / 10) * 100);
  const testCaseRequirementMet = testCases.length + examples.length >= 3;
  const referenceRequirementMet = referenceSolution.includes("return");
  const savedSecondsAgo = Math.max(0, Math.floor((now - lastSavedAt.getTime()) / 1000));
  const autosaveText = isAutosaving ? "Saving..." : `Saved ${savedSecondsAgo}s ago`;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!autosaveHasMounted.current) {
      autosaveHasMounted.current = true;
      return;
    }

    setIsAutosaving(true);
    const timeout = window.setTimeout(() => {
      setLastSavedAt(new Date());
      setNow(Date.now());
      setIsAutosaving(false);
    }, 850);

    return () => window.clearTimeout(timeout);
  }, [description, difficulty, examples, languages, referenceSolution, slug, starterCode, tags, testCases, title]);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugWasEdited) {
      setSlug(slugifyTitle(value));
    }
  }

  function toggleLanguage(language: ProblemType) {
    setLanguages((current) => {
      if (current.includes(language)) {
        return current.length === 1 ? current : current.filter((item) => item !== language);
      }

      return [...current, language];
    });
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function addExample() {
    setExamples((current) => [
      ...current,
      {
        label: `Example ${current.length + 1}`,
        input: "n = 3",
        output: "3",
        extraOutput: "",
        explanation: "1+1+1, 1+2, 2+1",
      },
    ]);
  }

  function updateTestCase(index: number, field: keyof TestCaseDraft, value: string | boolean) {
    setTestCases((current) =>
      current.map((testCase, currentIndex) =>
        currentIndex === index ? { ...testCase, [field]: value } : testCase,
      ),
    );
  }

  function addTestCase() {
    setTestCases((current) => [...current, { input: "", expectedOutput: "", hidden: false }]);
  }

  const languageStyles: Record<ProblemType, { selected: string; unselected: string }> = {
    JAVA: {
      selected: "bg-[#F97316] text-white border-[#F97316]",
      unselected: "bg-orange-50 text-orange-700 border-orange-200",
    },
    SQL: {
      selected: "bg-[#3B82F6] text-white border-[#3B82F6]",
      unselected: "bg-blue-50 text-blue-700 border-blue-200",
    },
  };
  const difficultyStyles: Record<ProblemDifficulty, { selected: string; unselected: string; preview: string }> = {
    EASY: {
      selected: "bg-emerald-600 text-white border-emerald-600",
      unselected: "bg-emerald-50 text-emerald-700 border-emerald-200",
      preview: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    MEDIUM: {
      selected: "bg-amber-500 text-white border-amber-500",
      unselected: "bg-amber-50 text-amber-700 border-amber-200",
      preview: "bg-amber-50 text-amber-700 border-amber-200",
    },
    HARD: {
      selected: "bg-red-600 text-white border-red-600",
      unselected: "bg-red-50 text-red-700 border-red-200",
      preview: "bg-red-50 text-red-700 border-red-200",
    },
  };
  const toolbarIcons = [
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Link2,
    FileImage,
    Code2,
    Eraser,
  ];
  const readinessItems = [
    { label: "Title", complete: title.trim().length > 0 },
    { label: "Difficulty", complete: Boolean(difficulty) },
    { label: "At least 1 example", complete: examples.length > 0 },
    { label: "At least 3 test cases", complete: testCaseRequirementMet },
    { label: "Reference solution", complete: referenceRequirementMet },
  ];

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/20 !p-4 font-['Inter',system-ui,sans-serif] text-[14px] text-slate-900">
      <button
        aria-label="Close edit problem"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
        onClick={onClose}
        style={{ position: "fixed", left: "min(calc(100vw - 3.5rem), 42rem)", top: "1.5rem", zIndex: 200 }}
        type="button"
      >
        <X size={20} strokeWidth={2.25} />
      </button>
      <section
        aria-label="Edit Problem"
        aria-modal="true"
        className="relative mx-auto grid h-[calc(100vh-2rem)] min-w-0 w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 xl:max-w-6xl"
        role="dialog"
        style={{ height: "min(calc(100vh - 2rem), 40rem)", width: "min(calc(100vw - 2rem), 42rem)" }}
      >
        <header className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-[20px] font-bold tracking-[-0.01em] text-slate-950">Edit Problem</h2>
        </header>

        <div className="grid min-h-0 grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] divide-x divide-slate-200 bg-slate-50/60">
          <main className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-white px-4 py-4">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <div className="relative">
                  <input
                    aria-label="Problem title"
                    className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-white !py-0 !pl-3 !pr-16 text-[14px] font-semibold !text-slate-950 !shadow-none outline-none transition focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    value={title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-slate-500">
                    {completionPercent}%
                  </span>
                </div>

                <input
                  aria-label="Problem slug"
                  className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-slate-100 !px-3 !py-0 font-mono text-[13px] !text-slate-700 !shadow-none outline-none transition focus:!border-[#3B82F6] focus:!bg-white focus:!ring-4 focus:!ring-[#3B82F6]/15"
                  value={slug}
                  onChange={(event) => {
                    setSlugWasEdited(true);
                    setSlug(slugifyTitle(event.target.value));
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["JAVA", "SQL"] as ProblemType[]).map((language) => (
                  <button
                    className={`rounded-full border px-3 py-1 text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 ${
                      languages.includes(language) ? languageStyles[language].selected : languageStyles[language].unselected
                    }`}
                    key={language}
                    onClick={() => toggleLanguage(language)}
                    type="button"
                  >
                    {language}
                  </button>
                ))}
                {(["EASY", "MEDIUM", "HARD"] as ProblemDifficulty[]).map((level) => (
                  <button
                    className={`rounded-full border px-3 py-1 text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 ${
                      difficulty === level ? difficultyStyles[level].selected : difficultyStyles[level].unselected
                    }`}
                    key={level}
                    onClick={() => setDifficulty(level)}
                    type="button"
                  >
                    {displayDifficulty(level)}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700"
                    key={tag}
                  >
                    <Tag size={12} />
                    {tag}
                    <button
                      aria-label={`Remove ${tag}`}
                      className="rounded-full text-slate-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                      onClick={() => removeTag(tag)}
                      type="button"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  aria-label="Add tag"
                  className="!h-7 !w-36 !rounded-full !border !border-slate-200 !bg-white !px-3 !py-0 text-[12px] !shadow-none outline-none transition placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                  list="problem-tag-options"
                  placeholder="Add tag..."
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    event.preventDefault();
                    const value = event.currentTarget.value.trim();
                    if (value.length > 0 && !tags.includes(value)) {
                      setTags((current) => [...current, value]);
                      event.currentTarget.value = "";
                    }
                  }}
                />
                <datalist id="problem-tag-options">
                  <option value="arrays" />
                  <option value="dynamic-programming" />
                  <option value="recursion" />
                  <option value="sql" />
                </datalist>
              </div>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-end gap-4 border-b border-slate-200 px-3 pt-2">
                  {(["write", "preview"] as const).map((tab) => (
                    <button
                      className={`border-b-2 px-1 pb-2 text-[13px] font-semibold capitalize ${
                        descriptionTab === tab
                          ? "border-[#3B82F6] text-[#3B82F6]"
                          : "border-transparent text-slate-500 hover:text-slate-900"
                      }`}
                      key={tab}
                      onClick={() => setDescriptionTab(tab)}
                      type="button"
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <select
                    aria-label="Editor font"
                    className="!h-8 !w-28 !rounded-lg !border !border-slate-300 !bg-white !px-2 !py-0 text-[12px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                    defaultValue="Paragraph"
                  >
                    <option>Paragraph</option>
                    <option>Heading</option>
                    <option>Code</option>
                  </select>
                  {toolbarIcons.map((Icon, index) => (
                    <button
                      aria-label={`Formatting action ${index + 1}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
                      key={`${Icon.displayName ?? Icon.name}-${index}`}
                      type="button"
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
                {descriptionTab === "write" ? (
                  <textarea
                    aria-label="Problem description markdown"
                    className="!min-h-[108px] !w-full resize-none !rounded-none !border-0 !bg-white !p-3 text-[14px] !text-slate-800 !shadow-none outline-none placeholder:text-slate-400 focus:!ring-0"
                    placeholder="Describe the problem in markdown..."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                ) : (
                  <p className="min-h-[108px] p-3 text-[14px] leading-6 text-slate-700">{description}</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="space-y-1.5 text-[13px] text-slate-800">
                  <p className="font-bold text-slate-900">Example 1</p>
                  <p>
                    <span className="font-semibold">Input:</span> {examples[0]?.input}
                  </p>
                  <p>
                    <span className="font-semibold">Output:</span> {examples[0]?.output}
                  </p>
                  <p>
                    <span className="font-semibold">Output:</span> {examples[0]?.extraOutput}
                  </p>
                  <p>
                    <span className="font-semibold">Explanation:</span> {examples[0]?.explanation}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
                    onClick={addExample}
                    type="button"
                  >
                    <Plus size={14} /> Add example
                  </button>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 font-mono text-[12px] text-slate-600">
                    1 &lt;= n &lt;= 45
                  </span>
                </div>
              </section>

              <CodeEditorCard
                code={starterCode}
                language="JAVA"
                onChange={setStarterCode}
                title="JAVA"
                titleIcon={null}
              />

              <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
                <button
                  className="flex w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2 text-left text-[13px] font-semibold text-slate-200"
                  onClick={() => setReferenceExpanded((current) => !current)}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <ChevronDown
                      className={`transition ${referenceExpanded ? "rotate-0" : "-rotate-90"}`}
                      size={16}
                    />
                    <Lock size={14} />
                    Reference solution (Private)
                  </span>
                </button>
                {referenceExpanded ? (
                  <div className="border-t border-slate-800">
                    <CodeEditorCard
                      code={referenceSolution}
                      embedded
                      language="JAVA"
                      onChange={setReferenceSolution}
                      title="JAVA"
                      titleIcon={null}
                    />
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="bg-slate-50 text-[12px] font-semibold text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2">Input</th>
                      <th className="border-b border-slate-200 px-3 py-2">Expected Output</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-right">Hidden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.map((testCase, index) => (
                      <tr className="border-b border-slate-100 last:border-0" key={index}>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Test case ${index + 1} input`}
                            className="!h-8 !w-full !rounded-lg !border !border-slate-200 !bg-white !px-2 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            value={testCase.input}
                            onChange={(event) => updateTestCase(index, "input", event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            aria-label={`Test case ${index + 1} expected output`}
                            className="!h-8 !w-full !rounded-lg !border !border-slate-200 !bg-white !px-2 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            value={testCase.expectedOutput}
                            onChange={(event) => updateTestCase(index, "expectedOutput", event.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            aria-label={`Toggle hidden for test case ${index + 1}`}
                            className={`relative inline-flex h-5 w-9 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 ${
                              testCase.hidden ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            onClick={() => updateTestCase(index, "hidden", !testCase.hidden)}
                            type="button"
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                                testCase.hidden ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-slate-100 p-3">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
                    onClick={addTestCase}
                    type="button"
                  >
                    <Plus size={14} /> Add test case
                  </button>
                </div>
              </section>
            </div>
          </main>

          <aside className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-slate-50 px-4 py-4">
            <div className="sticky top-4 min-w-0 space-y-4">
              <h3 className="text-[18px] font-bold tracking-[-0.01em] text-slate-950">Live Preview</h3>
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-[16px] font-bold text-slate-950">{title || "Untitled Problem"}</h4>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-bold text-cyan-700">
                    <Clock3 size={12} />
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${difficultyStyles.EASY.preview}`}>
                    Easy
                  </span>
                  <span className="rounded-full border border-[#F97316] bg-[#F97316] px-2.5 py-1 text-[12px] font-bold text-white">
                    JAVA
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Hard
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-[14px] leading-5 text-slate-700">
                  Count how many distinct ways exist to reach the top, ccd dert from each tere.
                </p>
              </section>

              <dl className="space-y-1.5 text-[14px]">
                {[
                  ["Created", "Mar 10, 2026"],
                  ["Last edited", "Apr 22, 2026"],
                  ["Submissions", "1,204"],
                  ["Author", "You"],
                ].map(([label, value]) => (
                  <div className="flex gap-1" key={label}>
                    <dt className="font-semibold text-slate-700">{label}:</dt>
                    <dd className="text-slate-950">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2.5">
                {readinessItems.map((item) => (
                  <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-800" key={item.label}>
                    {item.complete ? (
                      <Check className="text-emerald-600" size={18} strokeWidth={2.5} />
                    ) : (
                      <Circle className="text-slate-400" size={17} />
                    )}
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex min-h-[60px] items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3">
          <div className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-700">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-white">
              <CheckCircle2 size={14} />
            </span>
            <span className="text-slate-500">{autosaveText}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-3 py-2 text-[14px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
              type="button"
            >
              Discard
            </button>
            <button
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
              type="button"
            >
              Save as draft
            </button>
            <button
              className="rounded-lg bg-[#3B82F6] px-4 py-2 text-[14px] font-bold text-white shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/25"
              type="button"
            >
              Submit for review
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

type CodeEditorCardProps = {
  code: string;
  embedded?: boolean;
  language: string;
  onChange: (value: string) => void;
  title: string;
  titleIcon: ReactNode;
};

function CodeEditorCard({ code, embedded = false, language, onChange, title, titleIcon }: CodeEditorCardProps) {
  const codeLines = code.split("\n");

  return (
    <section className={`${embedded ? "rounded-none border-0" : "overflow-hidden rounded-xl border border-slate-800"} bg-slate-950 text-slate-100`}>
      {!embedded ? (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3 py-2">
          <span className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-2 py-1 text-[12px] font-bold text-slate-100">
            {titleIcon}
            {title}
          </span>
          <div className="flex items-center gap-1">
            {[Copy, Expand, Settings, ChevronDown].map((Icon, index) => (
              <button
                aria-label={`Code editor control ${index + 1}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                key={`${Icon.displayName ?? Icon.name}-${index}`}
                type="button"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="relative min-h-[112px] py-3 font-mono text-[12px] leading-6" style={{ backgroundColor: "#0B1117" }}>
        <ol aria-hidden="true">
          {codeLines.map((line, index) => (
            <li className="grid grid-cols-[2.25rem_1fr] px-3" key={`${line}-${index}`}>
              <span className="select-none pr-3 text-right text-slate-500">{index + 1}</span>
              <code className="whitespace-pre text-slate-200">
                {line.includes("class") ? (
                  <>
                    <span className="text-violet-300">class</span>
                    {line.replace("class", "")}
                  </>
                ) : line.includes("public int") ? (
                  <>
                    <span className="text-violet-300">public</span> <span className="text-sky-300">int</span>
                    {line.replace("public int", "")}
                  </>
                ) : (
                  line
                )}
              </code>
            </li>
          ))}
        </ol>
        <textarea
          aria-label={`${language} code editor`}
          className="absolute inset-0 !h-full !min-h-0 !w-full resize-none !rounded-none !border-0 !bg-transparent !px-[3.25rem] !py-3 font-mono text-[12px] leading-6 !text-transparent caret-white !shadow-none outline-none selection:!bg-blue-500/30 focus:!ring-0"
          spellCheck={false}
          style={{ background: "transparent" }}
          value={code}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </section>
  );
}

function CreateProblemPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProblemRequest>(defaultProblemForm);
  const [authorSection, setAuthorSection] = useState<AuthorSection>("setup");
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateExample(index: number, field: keyof ProblemExample, value: string | number) {
    setForm((current) => ({
      ...current,
      examples: current.examples.map((example, currentIndex) =>
        currentIndex === index ? { ...example, [field]: value } : example,
      ),
    }));
  }

  function addExample() {
    let nextIndex = 0;
    setForm((current) => {
      nextIndex = current.examples.length;
      return {
        ...current,
        examples: [
          ...current.examples,
          {
            label: `Example ${current.examples.length + 1}`,
            sortOrder: current.examples.length,
            inputData: "",
            expectedOutput: "",
            explanation: "",
          },
        ],
      };
    });
    setActiveExampleIndex(nextIndex);
  }

  function removeExample(index: number) {
    let nextCount = 0;
    setForm((current) => {
      const examples = current.examples
        .filter((_, currentIndex) => currentIndex !== index)
        .map((example, currentIndex) => ({ ...example, sortOrder: currentIndex }));
      nextCount = examples.length;
      return {
        ...current,
        examples,
      };
    });
    setActiveExampleIndex((current) => Math.max(0, Math.min(current >= index ? current - 1 : current, nextCount - 1)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const created = await createProblem({
        ...form,
        examples: form.examples.map((example, index) => ({ ...example, sortOrder: index })),
      });
      navigate(`/problems/${created.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save problem.");
    } finally {
      setIsSaving(false);
    }
  }

  const typeSpecificHints =
    form.type === "JAVA"
      ? {
          starter: "Define the expected method or class contract for Java solutions.",
          example:
            "Keep the examples structured so the future Java judge can map them into executable tests.",
        }
      : {
          starter: "Use starter code for the base SQL skeleton or the schema reminder.",
          example:
            "Treat example input as setup SQL and the expected output as the target result set.",
        };

  const activeExample = form.examples[activeExampleIndex] ?? form.examples[0];

  function sectionButton(section: AuthorSection, label: string) {
    return (
      <button
        className={`workspace-tab${authorSection === section ? " workspace-tab--active" : ""}`}
        onClick={() => setAuthorSection(section)}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <section className="viewport-page viewport-page--form">
      <div className="workspace-shell workspace-shell--author">
        <ScreenHeader
          compact
          description="Build a new Java or SQL exercise with starter code, examples, and reference material."
          kicker="Problem Authoring"
          title="Author Problems"
        />

        {error ? <div className="error-banner">{error}</div> : null}

        <form className="author-layout" onSubmit={handleSubmit}>
          <aside className="panel author-sidebar">
            <div className="author-sidebar__preview">
              <p className="section-kicker">Draft Preview</p>
              <h2>{form.title.trim() || "Untitled Problem"}</h2>
              <p>{form.summary.trim() || "Add a short summary to describe what the solver must do."}</p>
            </div>

            <div className="author-sidebar__meta">
              <ProblemMetaTags difficulty={form.difficulty} exampleCount={form.examples.length} type={form.type} />
            </div>

            <div className="author-sidebar__nav">
              {sectionButton("setup", "Setup")}
              {sectionButton("prompt", "Prompt")}
              {sectionButton("judge", "Judge")}
              {sectionButton("examples", "Examples")}
            </div>

            <div className="author-sidebar__actions">
              <button className="button button--primary" disabled={isSaving} type="submit">
                {isSaving ? "Saving…" : "Create problem"}
              </button>
            </div>
          </aside>

          <section className="panel author-panel">
            {authorSection === "setup" ? (
              <div className="author-section">
                <div className="author-section__header">
                  <h3>Setup</h3>
                  <p>Define the identity and scope of the problem.</p>
                </div>

                <div className="author-setup-grid">
                  <label className="author-field author-field--wide">
                    Title
                    <input
                      required
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </label>

                  <label className="author-field">
                    Slug
                    <input
                      placeholder="optional-custom-slug"
                      value={form.slug ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                    />
                  </label>

                  <label className="author-field">
                    Type
                    <select
                      value={form.type}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, type: event.target.value as ProblemType }))
                      }
                    >
                      <option value="JAVA">Java</option>
                      <option value="SQL">SQL</option>
                    </select>
                  </label>

                  <label className="author-field">
                    Difficulty
                    <select
                      value={form.difficulty}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          difficulty: event.target.value as ProblemDifficulty,
                        }))
                      }
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </label>

                  <label className="author-field author-field--wide">
                    Summary
                    <textarea
                      className="author-textarea author-textarea--summary"
                      required
                      maxLength={280}
                      rows={4}
                      value={form.summary}
                      onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {authorSection === "prompt" ? (
              <div className="author-section">
                <div className="author-section__header">
                  <h3>Prompt</h3>
                  <p>Write the main description and the constraints markdown.</p>
                </div>

                <div className="author-prompt-grid">
                  <label className="author-field author-field--editor">
                    Description
                    <textarea
                      className="author-textarea author-textarea--editor"
                      required
                      rows={14}
                      value={form.descriptionMarkdown}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, descriptionMarkdown: event.target.value }))
                      }
                    />
                  </label>

                  <label className="author-field author-field--editor">
                    Constraints (Markdown)
                    <textarea
                      className="author-textarea author-textarea--editor author-textarea--compact"
                      rows={12}
                      value={form.constraintsMarkdown ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, constraintsMarkdown: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {authorSection === "judge" ? (
              <div className="author-section">
                <div className="author-section__header">
                  <h3>Judge Material</h3>
                  <p>{typeSpecificHints.starter}</p>
                </div>

                <div className="author-judge-grid">
                  <label className="author-field author-field--editor">
                    Starter code
                    <textarea
                      className="author-textarea author-textarea--editor"
                      rows={12}
                      value={form.starterCode ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, starterCode: event.target.value }))}
                    />
                  </label>

                  <label className="author-field author-field--editor">
                    Reference solution
                    <textarea
                      className="author-textarea author-textarea--editor"
                      rows={12}
                      value={form.referenceSolution ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, referenceSolution: event.target.value }))
                      }
                    />
                  </label>

                  <label className="author-field author-field--wide">
                    Evaluation notes
                    <textarea
                      className="author-textarea author-textarea--compact"
                      rows={4}
                      value={form.evaluationNotes ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, evaluationNotes: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {authorSection === "examples" && activeExample ? (
              <div className="author-section">
                <div className="author-section__header">
                  <h3>Examples</h3>
                  <p>{typeSpecificHints.example}</p>
                </div>

                <div className="author-examples__toolbar">
                  <div className="author-examples__tabs">
                    {form.examples.map((example, index) => (
                      <button
                        className={`workspace-tab${index === activeExampleIndex ? " workspace-tab--active" : ""}`}
                        key={`${example.label}-${index}`}
                        onClick={() => setActiveExampleIndex(index)}
                        type="button"
                      >
                        {example.label || `Example ${index + 1}`}
                      </button>
                    ))}
                  </div>

                  <div className="author-examples__actions">
                    <button className="button button--ghost button--sm" onClick={addExample} type="button">
                      Add example
                    </button>
                    {form.examples.length > 1 ? (
                      <button
                        className="button button--ghost button--sm"
                        onClick={() => removeExample(activeExampleIndex)}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="author-example-layout">
                  <label className="author-field">
                    Label
                    <input
                      value={activeExample.label}
                      onChange={(event) => updateExample(activeExampleIndex, "label", event.target.value)}
                    />
                  </label>

                  <label className="author-field">
                    Explanation
                    <textarea
                      className="author-textarea author-textarea--compact"
                      rows={4}
                      value={activeExample.explanation ?? ""}
                      onChange={(event) => updateExample(activeExampleIndex, "explanation", event.target.value)}
                    />
                  </label>

                  <label className="author-field author-field--editor">
                    Input
                    <textarea
                      className="author-textarea author-textarea--editor author-textarea--code"
                      required
                      rows={12}
                      value={activeExample.inputData}
                      onChange={(event) => updateExample(activeExampleIndex, "inputData", event.target.value)}
                    />
                  </label>

                  <label className="author-field author-field--editor">
                    Expected output
                    <textarea
                      className="author-textarea author-textarea--editor author-textarea--code"
                      required
                      rows={12}
                      value={activeExample.expectedOutput}
                      onChange={(event) => updateExample(activeExampleIndex, "expectedOutput", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </section>
        </form>
      </div>
    </section>
  );
}

function ProblemDetailPage() {
  const { problemId = "" } = useParams();
  const [documentTab, setDocumentTab] = useState<DocumentTab>("description");
  const [resultPanelMode, setResultPanelMode] = useState<ResultPanelMode>("testcase");
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [testResult, setTestResult] = useState<Submission | null>(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [editorValue, setEditorValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const problemResponse = await getProblem(problemId);
        if (active) {
          setProblem(problemResponse);
          setTestResult(null);
          setResultPanelMode("testcase");
          setSelectedCaseIndex(0);
          setEditorValue(problemResponse.starterCode ?? "");
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load problem.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [problemId]);

  async function handleTestCode() {
    if (!problem) {
      return;
    }

    setIsTesting(true);
    setError(null);

    try {
      const created = await createSubmission(problem.id, {
        submittedLanguage: problem.type,
        sourceCode: editorValue,
      });
      setTestResult(created);
      setResultPanelMode("result");
      setSelectedCaseIndex(0);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to test code.");
    } finally {
      setIsTesting(false);
    }
  }

  useEffect(() => {
    if (resultPanelMode === "testcase") {
      if (problem && selectedCaseIndex >= problem.examples.length) {
        setSelectedCaseIndex(0);
      }
      return;
    }

    if (testResult && selectedCaseIndex >= testResult.caseResults.length) {
      setSelectedCaseIndex(0);
    }
  }, [problem, resultPanelMode, selectedCaseIndex, testResult]);

  const selectedExample = problem?.examples?.[selectedCaseIndex] ?? null;
  const selectedCaseResult = testResult?.caseResults?.[selectedCaseIndex] ?? null;
  const selectedInput = resultPanelMode === "result" && selectedCaseResult ? selectedCaseResult.inputData : selectedExample?.inputData ?? "";

  const title = problem?.title ?? "Problem Workspace";
  const description = problem?.summary ?? "Review the prompt and test a solution in the editor.";

  return (
    <section className="viewport-page viewport-page--workspace">
      <div className="workspace-shell workspace-shell--detail">
        <ScreenHeader compact description={description} kicker="Problem Workspace" title={title} />

        {isLoading ? <div className="empty-state">Loading problem…</div> : null}
        {error && !problem ? <div className="error-banner">{error}</div> : null}

        {!isLoading && problem ? (
          <div className="workspace-layout">
            <PanelGroup autoSaveId="problem-workspace-horizontal" direction="horizontal">
              <Panel defaultSize={46} minSize={30}>
                <section className="workspace-pane glass-panel">
                  <div className="workspace-pane__header">
                    <div className="workspace-tabs">
                      <button
                        className={`workspace-tab${documentTab === "description" ? " workspace-tab--active" : ""}`}
                        onClick={() => setDocumentTab("description")}
                        type="button"
                      >
                        Description
                      </button>
                      <button
                        className={`workspace-tab${documentTab === "solution" ? " workspace-tab--active" : ""}`}
                        onClick={() => setDocumentTab("solution")}
                        type="button"
                      >
                        Reference
                      </button>
                      <button
                        className={`workspace-tab${documentTab === "notes" ? " workspace-tab--active" : ""}`}
                        onClick={() => setDocumentTab("notes")}
                        type="button"
                      >
                        Notes
                      </button>
                    </div>
                    <ProblemMetaTags
                      difficulty={problem.difficulty}
                      exampleCount={problem.examples.length}
                      type={problem.type}
                    />
                  </div>

                  <div className="workspace-pane__scroll">
                    {documentTab === "description" ? (
                      <div className="detail-content">
                        <section className="content-block">
                          <h3>Prompt</h3>
                          <MarkdownBlock content={problem.descriptionMarkdown} />
                        </section>

                        <section className="content-block">
                          <h3>Examples</h3>
                          <div className="examples-list">
                            {problem.examples.map((example) => (
                              <ExamplePresentation
                                example={example}
                                key={example.id ?? `${example.label}-${example.sortOrder}`}
                                problemType={problem.type}
                              />
                            ))}
                          </div>
                        </section>

                        {problem.constraintsMarkdown ? (
                          <section className="content-block">
                            <h3>Constraints</h3>
                            <MarkdownBlock content={problem.constraintsMarkdown} />
                          </section>
                        ) : null}
                      </div>
                    ) : null}

                    {documentTab === "solution" ? (
                      <div className="detail-content">
                        <section className="content-block">
                          <h3>Starter code</h3>
                          <CodePreview
                            language={editorLanguageFor(problem.type)}
                            maxHeight={260}
                            minHeight={140}
                            value={problem.starterCode ?? "// No starter code provided."}
                          />
                        </section>

                        <section className="content-block">
                          <h3>Reference solution</h3>
                          <CodePreview
                            language={editorLanguageFor(problem.type)}
                            maxHeight={320}
                            minHeight={160}
                            value={problem.referenceSolution ?? "// No reference solution provided."}
                          />
                        </section>
                      </div>
                    ) : null}

                    {documentTab === "notes" ? (
                      <div className="detail-content">
                        <section className="content-block">
                          <h3>Judge notes</h3>
                          <MarkdownBlock content={problem.evaluationNotes ?? "No notes available."} />
                        </section>

                        <section className="content-block">
                          <h3>Created</h3>
                          <p>{formatLongDate(problem.createdAt)}</p>
                        </section>

                        <section className="content-block">
                          <h3>Last updated</h3>
                          <p>{formatLongDate(problem.updatedAt)}</p>
                        </section>
                      </div>
                    ) : null}
                  </div>
                </section>
              </Panel>

              <PanelResizeHandle className="resize-handle resize-handle--vertical" />

              <Panel defaultSize={54} minSize={30}>
                <PanelGroup autoSaveId="problem-workspace-vertical" direction="vertical">
                  <Panel defaultSize={74} minSize={45}>
                    <section className="workspace-pane glass-panel">
                      <div className="workspace-pane__header">
                        <div>
                          <p className="section-kicker">Code Editor</p>
                          <h2 className="workspace-pane__title">Write your solution</h2>
                        </div>

                        <div className="editor-toolbar">
                          <span className="editor-toolbar__language">{problem.type}</span>
                          <button className="button button--primary button--sm" onClick={handleTestCode} type="button">
                            {isTesting ? "Testing…" : "Test Code"}
                          </button>
                        </div>
                      </div>

                      <div className="editor-shell">
                        <Editor
                          beforeMount={configureMonacoTheme}
                          height="100%"
                          language={editorLanguageFor(problem.type)}
                          onChange={(value) => setEditorValue(value ?? "")}
                          options={{
                            automaticLayout: true,
                            fontFamily: "Chakra Petch, monospace",
                            fontLigatures: true,
                            fontSize: 12,
                            lineHeight: 19,
                            lineNumbersMinChars: 3,
                            minimap: { enabled: false },
                            overviewRulerBorder: false,
                            overviewRulerLanes: 0,
                            padding: { top: 14, bottom: 14 },
                            scrollbar: {
                              alwaysConsumeMouseWheel: false,
                              horizontalScrollbarSize: 8,
                              verticalScrollbarSize: 8,
                            },
                            smoothScrolling: true,
                            wordWrap: "on",
                          }}
                          theme="juro-liquid"
                          value={editorValue}
                        />
                      </div>
                    </section>
                  </Panel>

                  <PanelResizeHandle className="resize-handle resize-handle--horizontal" />

                  <Panel defaultSize={26} minSize={20}>
                    <section className="workspace-pane glass-panel">
                      <div className="workspace-pane__header">
                        <div>
                          <p className="section-kicker">Results</p>
                          <h2 className="workspace-pane__title">Test Results</h2>
                        </div>
                        <div className="result-mode-switch">
                          <button
                            className={`workspace-tab${resultPanelMode === "testcase" ? " workspace-tab--active" : ""}`}
                            onClick={() => setResultPanelMode("testcase")}
                            type="button"
                          >
                            Testcase
                          </button>
                          <button
                            className={`workspace-tab${resultPanelMode === "result" ? " workspace-tab--active" : ""}`}
                            disabled={!testResult}
                            onClick={() => setResultPanelMode("result")}
                            type="button"
                          >
                            Test Result
                          </button>
                        </div>
                      </div>

                      <div className="workspace-pane__scroll">
                        {error ? <div className="error-banner">{error}</div> : null}
                        <div className="results-shell">
                          {resultPanelMode === "result" && testResult ? (
                            <div className="results-overview">
                              <div className={`results-overview__status results-overview__status--${testResult.status.toLowerCase()}`}>
                                {testResult.status}
                              </div>
                              <div className="results-overview__meta">
                                <span>Runtime: {testResult.totalRuntimeMillis ?? 0} ms</span>
                              </div>
                            </div>
                          ) : null}

                          <div className="case-tabs">
                            {(resultPanelMode === "result" && testResult ? testResult.caseResults : problem.examples).map((caseResult, index) => (
                              <button
                                className={`case-tab${index === selectedCaseIndex ? " case-tab--active" : ""}${resultPanelMode === "result" && "passed" in caseResult ? caseResult.passed ? " case-tab--passed" : " case-tab--failed" : ""}`}
                                key={`${caseResult.label}-${index}`}
                                onClick={() => setSelectedCaseIndex(index)}
                                type="button"
                              >
                                {caseResult.label}
                              </button>
                            ))}
                          </div>

                          {resultPanelMode === "result" && testResult && selectedCaseResult ? (
                            <div className="case-detail">
                              <div className="case-detail__summary">
                                <strong className={selectedCaseResult.passed ? "case-detail__badge case-detail__badge--passed" : "case-detail__badge case-detail__badge--failed"}>
                                  {selectedCaseResult.passed ? "Accepted" : "Rejected"}
                                </strong>
                                <span>Runtime: {selectedCaseResult.runtimeMillis} ms</span>
                              </div>

                              {parseStructuredInput(selectedCaseResult.inputData) ? (
                                <div className="case-input-inline">
                                  {Object.entries(parseStructuredInput(selectedCaseResult.inputData) ?? {}).map(([key, value]) => (
                                    <span className="case-input-chip" key={key}>
                                      <strong>{key}</strong>
                                      <code>{formatInlineValue(value)}</code>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <section className="content-block">
                                  <h3>Input</h3>
                                  <CodePreview
                                    language={problem.type === "SQL" ? "sql" : "plaintext"}
                                    maxHeight={180}
                                    minHeight={96}
                                    value={selectedCaseResult.inputData}
                                  />
                                </section>
                              )}

                              <section className="content-block">
                                <h3>Output</h3>
                                {isCompactValue(selectedCaseResult.actualOutput) ? (
                                  <code className="case-inline-output">{formatCodeSnippet(selectedCaseResult.actualOutput, exampleExpectedLanguage(selectedCaseResult.actualOutput))}</code>
                                ) : (
                                  <CodePreview
                                    language={exampleExpectedLanguage(selectedCaseResult.actualOutput)}
                                    maxHeight={180}
                                    minHeight={96}
                                    value={selectedCaseResult.actualOutput}
                                  />
                                )}
                              </section>

                              <section className="content-block">
                                <h3>Expected</h3>
                                {isCompactValue(selectedCaseResult.expectedOutput) ? (
                                  <code className="case-inline-output">{formatCodeSnippet(selectedCaseResult.expectedOutput, exampleExpectedLanguage(selectedCaseResult.expectedOutput))}</code>
                                ) : (
                                  <CodePreview
                                    language={exampleExpectedLanguage(selectedCaseResult.expectedOutput)}
                                    maxHeight={180}
                                    minHeight={96}
                                    value={selectedCaseResult.expectedOutput}
                                  />
                                )}
                              </section>

                              <section className="content-block">
                                <h3>Notes</h3>
                                <p>{selectedCaseResult.note}</p>
                              </section>
                            </div>
                          ) : selectedExample ? (
                            <div className="case-detail">
                              {parseStructuredInput(selectedInput) ? (
                                <div className="case-input-inline">
                                  {Object.entries(parseStructuredInput(selectedInput) ?? {}).map(([key, value]) => (
                                    <span className="case-input-chip" key={key}>
                                      <strong>{key}</strong>
                                      <code>{formatInlineValue(value)}</code>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <section className="content-block">
                                  <h3>Input</h3>
                                  <CodePreview
                                    language={problem.type === "SQL" ? "sql" : "plaintext"}
                                    maxHeight={180}
                                    minHeight={96}
                                    value={selectedInput}
                                  />
                                </section>
                              )}

                              <section className="content-block">
                                <h3>Expected</h3>
                                {isCompactValue(selectedExample.expectedOutput) ? (
                                  <code className="case-inline-output">{formatCodeSnippet(selectedExample.expectedOutput, exampleExpectedLanguage(selectedExample.expectedOutput))}</code>
                                ) : (
                                  <CodePreview
                                    language={exampleExpectedLanguage(selectedExample.expectedOutput)}
                                    maxHeight={180}
                                    minHeight={96}
                                    value={selectedExample.expectedOutput}
                                  />
                                )}
                              </section>

                              {selectedExample.explanation ? (
                                <section className="content-block">
                                  <h3>Explanation</h3>
                                  <p>{selectedExample.explanation}</p>
                                </section>
                              ) : null}

                              {!testResult ? (
                                <div className="empty-state">Run Test Code to compare your output with the expected result for each case.</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default App;
