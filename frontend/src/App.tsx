// Added: @radix-ui/react-select for styled dropdowns, react-hook-form + zod for form validation.
import Editor from "@monaco-editor/react";
import * as Select from "@radix-ui/react-select";
import { zodResolver } from "@hookform/resolvers/zod";
import { ComponentProps, createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  MoreVertical,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sun,
  Tag,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import remarkGfm from "remark-gfm";
import { createSubmission, getProblem, listProblems } from "./api";
import type {
  ProblemDetail,
  ProblemDifficulty,
  ProblemExample,
  ProblemSummary,
  ProblemType,
  Submission,
} from "./types";

type DocumentTab = "description" | "solution" | "notes";
type CodeLanguage = "java" | "sql" | "json" | "plaintext";
type ResultPanelMode = "testcase" | "result";

type MonacoBeforeMount = NonNullable<ComponentProps<typeof Editor>["beforeMount"]>;
type Monaco = Parameters<MonacoBeforeMount>[0];
type ThemeMode = "light" | "dark";
type MarkdownNode = {
  type?: string;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
};

const ThemeContext = createContext<{ theme: ThemeMode; toggleTheme: () => void }>({
  theme: "light",
  toggleTheme: () => undefined,
});

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem("juro-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useAppTheme() {
  return useContext(ThemeContext);
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useAppTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="icon-button"
      onClick={toggleTheme}
      type="button"
    >
      <Icon size={17} strokeWidth={2.25} />
    </button>
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("juro-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<ProblemListPage />} />
            <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
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
      </div>
      {children ? <div className="screen-header__extras">{children}</div> : null}
    </header>
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

function statusForProblem(problem: Pick<ProblemSummary, "slug">): CatalogStatus {
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
        remarkPlugins={[remarkGfm, remarkUnderline]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function constraintItemsFromMarkdown(value?: string | null) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, "").trim().replace(/^`+|`+$/g, "").trim())
    .filter(Boolean);
}

function remarkUnderline() {
  return (tree: MarkdownNode) => {
    transformUnderlineNodes(tree);
  };
}

function transformUnderlineNodes(node: MarkdownNode) {
  if (!node.children) {
    return;
  }

  const nextChildren: MarkdownNode[] = [];

  node.children.forEach((child) => {
    if (child.type === "text" && child.value?.includes("++")) {
      nextChildren.push(...splitUnderlineText(child.value));
      return;
    }

    transformUnderlineNodes(child);
    nextChildren.push(child);
  });

  node.children = nextChildren;
}

function splitUnderlineText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const pattern = /\+\+([\s\S]+?)\+\+/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push({ type: "text", value: value.slice(cursor, match.index) });
    }

    nodes.push({
      type: "underline",
      data: {
        hName: "u",
      },
      children: [{ type: "text", value: match[1] }],
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) {
    nodes.push({ type: "text", value: value.slice(cursor) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", value }];
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="min-h-[108px] p-3 text-[14px] leading-6 text-slate-700">
      {content.trim() ? (
        <ReactMarkdown
          components={{
            code({ children, className }) {
              const isBlock = (className ?? "").includes("language-");
              if (isBlock) {
                return (
                  <pre className="my-2 overflow-auto rounded-lg bg-slate-950 p-3 text-[12px] leading-5 text-slate-100">
                    <code>{children}</code>
                  </pre>
                );
              }

              return <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-900">{children}</code>;
            },
            a({ children, href }) {
              return (
                <a className="font-semibold text-[#3B82F6] underline-offset-2 hover:underline" href={href}>
                  {children}
                </a>
              );
            },
          }}
          remarkPlugins={[remarkGfm, remarkUnderline]}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-slate-400">Preview will appear here.</p>
      )}
    </div>
  );
}

type FormSelectOption<T extends string> = {
  disabled?: boolean;
  label: string;
  value: T;
};

type FormSelectProps<T extends string> = {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: T) => void;
  options: readonly FormSelectOption<T>[];
  value: T;
};

function FormSelect<T extends string>({
  ariaLabel,
  className = "",
  disabled = false,
  onValueChange,
  options,
  value,
}: FormSelectProps<T>) {
  return (
    <Select.Root disabled={disabled} value={value} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
      <Select.Trigger aria-label={ariaLabel} className={`form-select-trigger ${className}`} disabled={disabled}>
        <Select.Value />
        <Select.Icon asChild>
          <ChevronDown size={14} strokeWidth={2.35} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="form-select-content" collisionPadding={12} position="popper" sideOffset={6}>
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                className="form-select-item"
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="form-select-item__indicator">
                  <Check size={13} strokeWidth={2.5} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="form-error">{message}</p>;
}

type MarkdownEditorProps = {
  activeTab: "write" | "preview";
  onChange: (value: string) => void;
  onTabChange: (tab: "write" | "preview") => void;
  value: string;
};

function MarkdownEditor({ activeTab, onChange, onTabChange, value }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function updateSelection(nextValue: string, selectionStart: number, selectionEnd = selectionStart) {
    onChange(nextValue);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function withSelection(format: (selected: string) => { text: string; cursorStart?: number; cursorEnd?: number }) {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(selectionStart, selectionEnd);
    const formatted = format(selected);
    const nextValue = `${value.slice(0, selectionStart)}${formatted.text}${value.slice(selectionEnd)}`;
    const cursorStart = selectionStart + (formatted.cursorStart ?? formatted.text.length);
    const cursorEnd = selectionStart + (formatted.cursorEnd ?? formatted.cursorStart ?? formatted.text.length);

    updateSelection(nextValue, cursorStart, cursorEnd);
  }

  function prefixLines(prefixer: (index: number) => string) {
    withSelection((selected) => {
      const fallback = "List item";
      const lines = (selected || fallback).split(/\r?\n/);
      return {
        text: lines.map((line, index) => `${prefixer(index)}${line.replace(/^([-*]|\d+\.)\s+/, "")}`).join("\n"),
      };
    });
  }

  function stripFormatting(text: string) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\+\+([\s\S]+?)\+\+/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^([-*]|\d+\.)\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  }

  function applyFormat(format: string) {
    onTabChange("write");

    if (format === "heading") {
      withSelection((selected) => ({ text: `## ${selected || "Heading"}` }));
      return;
    }

    if (format === "inline-code") {
      withSelection((selected) => ({ text: `\`${selected || "code"}\`` }));
      return;
    }

    if (format === "code-block") {
      withSelection((selected) => ({ text: `\n\`\`\`\n${selected || "code"}\n\`\`\`\n` }));
    }
  }

  const toolbarActions = [
    {
      label: "Bold",
      icon: Bold,
      action: () => withSelection((selected) => ({ text: `**${selected || "bold text"}**` })),
    },
    {
      label: "Italic",
      icon: Italic,
      action: () => withSelection((selected) => ({ text: `*${selected || "italic text"}*` })),
    },
    {
      label: "Underline",
      icon: Underline,
      action: () => withSelection((selected) => ({ text: `++${selected || "underlined text"}++` })),
    },
    {
      label: "Bullet list",
      icon: List,
      action: () => prefixLines(() => "- "),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      action: () => prefixLines((index) => `${index + 1}. `),
    },
    {
      label: "Link",
      icon: Link2,
      action: () => withSelection((selected) => ({ text: `[${selected || "link text"}](https://example.com)` })),
    },
    {
      label: "Image",
      icon: FileImage,
      action: () => withSelection((selected) => ({ text: `![${selected || "alt text"}](https://example.com/image.png)` })),
    },
    {
      label: "Code block",
      icon: Code2,
      action: () => applyFormat("code-block"),
    },
    {
      label: "Clear formatting",
      icon: Eraser,
      action: () =>
        withSelection((selected) => {
          const source = selected || value;
          const cleaned = stripFormatting(source);
          return { text: cleaned };
        }),
    },
  ];
  const editorFormatOptions = [
    { label: "Paragraph", value: "paragraph" },
    { label: "Heading", value: "heading" },
    { label: "Inline code", value: "inline-code" },
    { label: "Code block", value: "code-block" },
  ] as const;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-end gap-4 border-b border-slate-200 px-3 pt-2">
        {(["write", "preview"] as const).map((tab) => (
          <button
            className={`border-b-2 px-1 pb-2 text-[13px] font-semibold capitalize ${
              activeTab === tab
                ? "border-[#3B82F6] text-[#3B82F6]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
            key={tab}
            onClick={() => onTabChange(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <FormSelect
          ariaLabel="Editor format"
          className="h-8 w-32 text-[12px]"
          options={editorFormatOptions}
          value="paragraph"
          onValueChange={(value) => {
            if (value !== "paragraph") {
              applyFormat(value);
            }
          }}
        />
        {toolbarActions.map(({ action, icon: Icon, label }) => (
          <button
            aria-label={label}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:h-8 md:w-8"
            key={label}
            onClick={action}
            type="button"
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      {activeTab === "write" ? (
        <textarea
          ref={textareaRef}
          aria-label="Problem description markdown"
          className="!min-h-[132px] !w-full resize-y !rounded-none !border-0 !bg-white !p-3 text-[14px] !text-slate-800 !shadow-none outline-none placeholder:text-slate-400 focus:!ring-0"
          placeholder="Describe the problem in markdown..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <MarkdownPreview content={value} />
      )}
    </section>
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

  monaco.editor.defineTheme("juro-author-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748B", fontStyle: "italic" },
      { token: "keyword", foreground: "A78BFA" },
      { token: "string", foreground: "86EFAC" },
      { token: "number", foreground: "FBBF24" },
      { token: "type", foreground: "7DD3FC" },
    ],
    colors: {
      "editor.background": "#0B1117",
      "editorLineNumber.foreground": "#64748B",
      "editorLineNumber.activeForeground": "#CBD5E1",
      "editorCursor.foreground": "#3B82F6",
      "editor.selectionBackground": "#1D4ED866",
      "editor.lineHighlightBackground": "#111827",
      "editorGutter.background": "#0B1117",
      "editorBracketMatch.background": "#1D4ED855",
      "editorBracketMatch.border": "#3B82F6",
    },
  });

  monaco.editor.defineTheme("juro-author-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94A3B8", fontStyle: "italic" },
      { token: "keyword", foreground: "2563EB" },
      { token: "string", foreground: "047857" },
      { token: "number", foreground: "B45309" },
      { token: "type", foreground: "0369A1" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editorLineNumber.foreground": "#CBD5E1",
      "editorLineNumber.activeForeground": "#475569",
      "editorCursor.foreground": "#3B82F6",
      "editor.selectionBackground": "#BFDBFE",
      "editor.lineHighlightBackground": "#F8FAFC",
      "editorGutter.background": "#FFFFFF",
      "editorBracketMatch.background": "#DBEAFE",
      "editorBracketMatch.border": "#3B82F6",
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
  const { theme } = useAppTheme();
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
        theme={theme === "dark" ? "juro-author-dark" : "juro-liquid"}
        value={normalized}
      />
    </div>
  );
}

function ProblemListPage() {
  const navigate = useNavigate();
  const pageSize = useResponsivePageSize();
  const [pageIndex, setPageIndex] = useState(0);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [editProblemMode, setEditProblemMode] = useState<"edit" | "new" | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<CatalogProblem | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CatalogProblem | null>(null);
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
    if (!openActionMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-action-menu-root]")) {
        return;
      }

      setOpenActionMenuId(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenActionMenuId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionMenuId]);

  useEffect(() => {
    if (!deleteCandidate) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDeleteCandidate(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteCandidate]);

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

  function openNewProblemModal() {
    setSelectedProblem(null);
    setEditProblemMode("new");
  }

  function openEditProblemModal(problem: CatalogProblem) {
    setSelectedProblem(problem);
    setEditProblemMode("edit");
    setOpenActionMenuId(null);
  }

  function closeEditProblemModal() {
    setEditProblemMode(null);
    setSelectedProblem(null);
  }

  function confirmDeleteProblem() {
    if (!deleteCandidate) {
      return;
    }

    setProblems((current) => current.filter((problem) => problem.id !== deleteCandidate.id));
    setDeleteCandidate(null);
  }

  function navigateToProblem(problemId: string) {
    navigate(`/problems/${problemId}`);
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
              <div className="problem-bank-header__actions">
                <ThemeToggleButton />
                <button aria-label="Settings" className="icon-button" type="button">
                  <Settings size={17} strokeWidth={2.25} />
                </button>
              </div>
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
            <div className="catalog-toolbar__meta">
              <button aria-label="New Problem" className="new-problem-button" onClick={openNewProblemModal} type="button">
                <Plus size={15} strokeWidth={2.4} />
                <span>New Problem</span>
              </button>
              <div className="catalog-count">{problemBankDisplayTotal} problems</div>
            </div>
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
                  className={`catalog-sort catalog-sort--${header.key} catalog-sort--${header.align ?? "left"}${
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
              <div className="catalog-actions-head">Actions</div>
            </div>

            <div className="catalog-table__body">
              {isLoading ? <div className="empty-state">Loading problems…</div> : null}
              {error ? <div className="error-banner">{error}</div> : null}
              {!isLoading && !error && pagedProblems.length === 0 ? (
                <div className="empty-state">No problems match the current filters.</div>
              ) : null}

              {pagedProblems.map((problem, index) => (
                <div
                  className="catalog-row"
                  key={problem.id}
                  onClick={() => navigateToProblem(problem.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigateToProblem(problem.id);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
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

                  <div className="catalog-row__cell catalog-row__cell--language" data-label="Language">
                    <span className={`tag tag--language tag--${problem.type.toLowerCase()}`}>
                      {displayLanguage(problem.type)}
                    </span>
                  </div>

                  <div className="catalog-row__cell catalog-row__cell--difficulty" data-label="Difficulty">
                    <span className={`tag tag--difficulty tag--${problem.difficulty.toLowerCase()}`}>
                      {displayDifficulty(problem.difficulty)}
                    </span>
                  </div>

                  <div
                    className={`catalog-row__cell catalog-row__cell--number catalog-row__cell--avg-time${
                      problem.avgTimeMinutes === null ? " catalog-row__cell--muted" : ""
                    }`}
                    data-label="Avg Time"
                  >
                    {formatAvgTime(problem.avgTimeMinutes)}
                  </div>

                  <div
                    className="catalog-row__cell catalog-row__cell--number catalog-row__cell--muted catalog-row__cell--updated"
                    data-label="Updated"
                  >
                    {formatCatalogDate(problem.updatedAt)}
                  </div>

                  <div className="catalog-row__cell catalog-row__actions" data-action-menu-root data-label="Actions">
                    <button
                      aria-expanded={openActionMenuId === problem.id}
                      aria-haspopup="menu"
                      aria-label={`Actions for ${problem.displayTitle}`}
                      className="action-menu-trigger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenActionMenuId((current) => (current === problem.id ? null : problem.id));
                      }}
                      type="button"
                    >
                      <MoreVertical size={17} strokeWidth={2.3} />
                    </button>

                    {openActionMenuId === problem.id ? (
                      <div
                        className={`action-menu${index >= pagedProblems.length - 2 ? " action-menu--up" : ""}`}
                        role="menu"
                      >
                        <button
                          className="action-menu__item"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditProblemModal(problem);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          className="action-menu__item action-menu__item--danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteCandidate(problem);
                            setOpenActionMenuId(null);
                          }}
                          role="menuitem"
                          type="button"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
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

            <div className="catalog-pager__mobile-label">
              Page {safePageIndex + 1} of {totalPages}
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

      {deleteCandidate ? (
        <div
          className="delete-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteCandidate(null);
            }
          }}
        >
          <section
            aria-label={`Delete ${deleteCandidate.displayTitle}`}
            aria-modal="true"
            className="delete-confirmation"
            role="alertdialog"
          >
            <p className="delete-confirmation__message">
              Delete {deleteCandidate.displayTitle}? This cannot be undone.
            </p>
            <div className="delete-confirmation__actions">
              <button className="delete-confirmation__cancel" onClick={() => setDeleteCandidate(null)} type="button">
                Cancel
              </button>
              <button className="delete-confirmation__delete" onClick={confirmDeleteProblem} type="button">
                Delete
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {editProblemMode ? (
        <EditProblemDrawer
          key={editProblemMode === "edit" ? selectedProblem?.id ?? "edit" : "new"}
          mode={editProblemMode}
          onClose={closeEditProblemModal}
          problem={selectedProblem}
        />
      ) : null}
    </section>
  );
}

type EditProblemDrawerProps = {
  mode: "edit" | "new";
  onClose: () => void;
  problem?: CatalogProblem | null;
};

type TestValueType = "int" | "long" | "double" | "boolean" | "String" | "int[]" | "String[]" | "Object";

type TestCaseDraft = {
  inputType: TestValueType;
  input: string;
  expectedOutput: string;
  hidden: boolean;
};

type ExampleDraft = {
  id: string;
  input: string;
  output: string;
  explanation: string;
};

type EditProblemDraft = {
  title: string;
  slug: string;
  languages: ProblemType[];
  difficulty: ProblemDifficulty | null;
  returnType: TestValueType;
  tags: string[];
  description: string;
  examples: ExampleDraft[];
  starterCode: string;
  referenceSolution: string;
  testCases: TestCaseDraft[];
};

function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createExampleDraft(index: number, values?: Partial<Omit<ExampleDraft, "id">>): ExampleDraft {
  return {
    id: `example-${Date.now()}-${index}`,
    input: values?.input ?? "",
    output: values?.output ?? "",
    explanation: values?.explanation ?? "",
  };
}

const testValueTypes: TestValueType[] = ["int", "long", "double", "boolean", "String", "int[]", "String[]", "Object"];
const maxTagCount = 5;

function validateTypedValue(type: TestValueType, value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isValid = (() => {
    if (type === "int" || type === "long") {
      return /^-?\d+$/.test(trimmed);
    }

    if (type === "double") {
      return /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed);
    }

    if (type === "boolean") {
      return /^(true|false)$/i.test(trimmed);
    }

    if (type === "String") {
      return true;
    }

    if (type === "int[]") {
      const normalized = trimmed.replace(/^\[/, "").replace(/\]$/, "").trim();
      return normalized.length === 0 || normalized.split(",").every((item) => /^-?\d+$/.test(item.trim()));
    }

    if (type === "String[]") {
      const normalized = trimmed.replace(/^\[/, "").replace(/\]$/, "").trim();
      return normalized.length === 0 || normalized.split(",").every((item) => item.trim().length > 0);
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed);
    } catch {
      return false;
    }
  })();

  return isValid ? null : `Expected ${type}, got '${trimmed}'`;
}

const languageSelectOptions = [
  { label: "JAVA", value: "JAVA" },
  { label: "SQL", value: "SQL" },
] as const satisfies readonly FormSelectOption<ProblemType>[];

const returnTypeOptions = testValueTypes.map((type) => ({ label: type, value: type })) satisfies FormSelectOption<TestValueType>[];

const problemSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title must be 100 characters or fewer"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes only"),
    languages: z.array(z.enum(["JAVA", "SQL"])).min(1, "Select at least one language"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"], { error: "Select a difficulty" }),
    returnType: z.enum(["int", "long", "double", "boolean", "String", "int[]", "String[]", "Object"]),
    tags: z.array(z.string()).max(maxTagCount, "Maximum 5 tags allowed"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    examples: z
      .array(
        z.object({
          id: z.string().optional(),
          input: z.string().min(1, "Input is required"),
          output: z.string().min(1, "Output is required"),
          explanation: z.string().optional(),
        }),
      )
      .min(1, "Add at least one example"),
    starterCode: z.string().min(1, "Starter code is required"),
    referenceSolution: z.string().optional(),
    testCases: z
      .array(
        z.object({
          inputType: z.enum(["int", "long", "double", "boolean", "String", "int[]", "String[]", "Object"]),
          input: z.string().min(1, "Input is required"),
          expectedOutput: z.string().min(1, "Expected output is required"),
          hidden: z.boolean(),
        }),
      )
      .min(3, "Add at least 3 test cases"),
  })
  .superRefine((value, context) => {
    value.testCases.forEach((testCase, index) => {
      const inputError = validateTypedValue(testCase.inputType, testCase.input);
      if (inputError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: inputError,
          path: ["testCases", index, "input"],
        });
      }

      const expectedError = validateTypedValue(value.returnType, testCase.expectedOutput);
      if (expectedError) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: expectedError,
          path: ["testCases", index, "expectedOutput"],
        });
      }
    });
  });

type ProblemFormValues = z.infer<typeof problemSchema>;

function defaultEditorCode(language: ProblemType = "JAVA") {
  if (language === "SQL") {
    return "SELECT\n    *\nFROM table_name;";
  }

  return "class Solution {\n    public int climbStairs(int n) {\n    }\n}";
}

function defaultEditProblemDraft(): EditProblemDraft {
  return {
    title: "Climb Stairs Count",
    slug: "climb-stairs-count",
    languages: ["JAVA"],
    difficulty: "EASY",
    returnType: "int",
    tags: ["cho", "dynamic-programming", "recursion"],
    description: "You are climbing a staircase. It takes 'n' steps to reach the top.",
    examples: [
      createExampleDraft(0, {
        input: "n = 2",
        output: "2",
        explanation: "1+1, 2",
      }),
    ],
    starterCode: defaultEditorCode("JAVA"),
    referenceSolution: defaultEditorCode("JAVA"),
    testCases: [
      { inputType: "int", input: "1", expectedOutput: "2", hidden: false },
      { inputType: "int", input: "", expectedOutput: "3", hidden: true },
    ],
  };
}

function newProblemDraft(): EditProblemDraft {
  return {
    title: "",
    slug: "",
    languages: [],
    difficulty: null,
    returnType: "int",
    tags: [],
    description: "",
    examples: [],
    starterCode: "",
    referenceSolution: "",
    testCases: [],
  };
}

function initialEditProblemDraft(mode: EditProblemDrawerProps["mode"], problem?: CatalogProblem | null): EditProblemDraft {
  if (mode === "new") {
    return newProblemDraft();
  }

  const draft = defaultEditProblemDraft();
  if (!problem) {
    return draft;
  }

  return {
    ...draft,
    title: problem.displayTitle,
    slug: problem.slug,
    languages: [problem.type],
    difficulty: problem.difficulty,
    description: problem.summary || draft.description,
    starterCode: defaultEditorCode(problem.type),
    referenceSolution: defaultEditorCode(problem.type),
  };
}

function EditProblemDrawer({ mode, onClose, problem }: EditProblemDrawerProps) {
  const initialDraft = initialEditProblemDraft(mode, problem);
  const [title, setTitle] = useState(initialDraft.title);
  const [slug, setSlug] = useState(initialDraft.slug);
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [languages, setLanguages] = useState<ProblemType[]>(initialDraft.languages);
  const [difficulty, setDifficulty] = useState<ProblemDifficulty | null>(initialDraft.difficulty);
  const [returnType, setReturnType] = useState<TestValueType>(initialDraft.returnType);
  const [tags, setTags] = useState(initialDraft.tags);
  const [descriptionTab, setDescriptionTab] = useState<"write" | "preview">("write");
  const [description, setDescription] = useState(initialDraft.description);
  const [examples, setExamples] = useState<ExampleDraft[]>(initialDraft.examples);
  const [starterCode, setStarterCode] = useState(initialDraft.starterCode);
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [referenceSolution, setReferenceSolution] = useState(initialDraft.referenceSolution);
  const [testCases, setTestCases] = useState<TestCaseDraft[]>(initialDraft.testCases);
  const [lastSavedAt, setLastSavedAt] = useState(() => new Date(Date.now() - 2000));
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const autosaveHasMounted = useRef(false);

  const filledCompletionItems = [
    title.trim().length > 0,
    slug.trim().length > 0,
    languages.length > 0,
    Boolean(difficulty),
    Boolean(returnType),
    tags.length > 0,
    description.trim().length > 0,
    examples.length > 0,
    starterCode.trim().length > 0,
    referenceSolution.trim().length > 0,
    testCases.length >= 3,
  ].filter(Boolean).length;
  const completionPercent = Math.round((filledCompletionItems / 11) * 100);
  const testCaseRequirementMet = testCases.length >= 3;
  const referenceRequirementMet = referenceSolution.includes("return");
  const savedSecondsAgo = Math.max(0, Math.floor((now - lastSavedAt.getTime()) / 1000));
  const autosaveText = isAutosaving ? "Saving..." : `Saved ${savedSecondsAgo}s ago`;
  const tagLimitReached = tags.length >= maxTagCount;
  const formValues = {
    title,
    slug,
    languages,
    difficulty: difficulty ?? undefined,
    returnType,
    tags,
    description,
    examples,
    starterCode,
    referenceSolution,
    testCases,
  } as ProblemFormValues;
  const {
    formState: { errors: formErrors, isValid: isHookFormValid },
    trigger,
  } = useForm<ProblemFormValues>({
    resolver: zodResolver(problemSchema),
    mode: "onChange",
    values: formValues,
  });
  const validationResult = problemSchema.safeParse(formValues);
  const validationIssues = validationResult.success ? [] : validationResult.error.issues;
  const isFormValid = validationResult.success && isHookFormValid;

  function issueMessageFor(path: Array<string | number>) {
    return validationIssues.find((issue) => path.every((part, index) => issue.path[index] === part))?.message;
  }

  function rootFieldError(field: keyof ProblemFormValues) {
    const hookFormMessage = formErrors[field]?.message;
    return typeof hookFormMessage === "string" ? hookFormMessage : issueMessageFor([field]);
  }

  function exampleFieldError(index: number, field: keyof Pick<ExampleDraft, "input" | "output">) {
    return issueMessageFor(["examples", index, field]);
  }

  function testCaseFieldError(index: number, field: "input" | "expectedOutput") {
    return issueMessageFor(["testCases", index, field]);
  }
  const submitDisabledReason = isFormValid ? undefined : "Complete the required fields and fix validation errors before submitting.";

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void trigger();
  }, [description, difficulty, examples, languages, referenceSolution, returnType, slug, starterCode, tags, testCases, title, trigger]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
  }, [description, difficulty, examples, languages, referenceSolution, returnType, slug, starterCode, tags, testCases, title]);

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugWasEdited) {
      setSlug(slugifyTitle(value));
    }
  }

  function toggleLanguage(language: ProblemType) {
    setLanguages((current) => {
      if (current.includes(language)) {
        return current.filter((item) => item !== language);
      }

      return [...current, language];
    });
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag));
  }

  function addExample() {
    setExamples((current) => [...current, createExampleDraft(current.length)]);
  }

  function updateExample(index: number, field: keyof Omit<ExampleDraft, "id">, value: string) {
    setExamples((current) =>
      current.map((example, currentIndex) =>
        currentIndex === index ? { ...example, [field]: value } : example,
      ),
    );
  }

  function removeExample(index: number) {
    setExamples((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateTestCase(index: number, field: keyof TestCaseDraft, value: string | boolean) {
    setTestCases((current) =>
      current.map((testCase, currentIndex) =>
        currentIndex === index ? { ...testCase, [field]: value } : testCase,
      ),
    );
  }

  function addTestCase() {
    setTestCases((current) => [...current, { inputType: "int", input: "", expectedOutput: "", hidden: false }]);
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
  const readinessItems = [
    { label: "Title", complete: !rootFieldError("title") },
    { label: "Difficulty", complete: !rootFieldError("difficulty") },
    { label: "At least 1 example", complete: !rootFieldError("examples") },
    { label: "At least 3 test cases", complete: testCaseRequirementMet && !rootFieldError("testCases") },
    { label: "Reference solution", complete: referenceRequirementMet },
  ];
  const dialogTitle = mode === "new" ? "New Problem" : "Edit Problem";
  const primaryActionLabel = mode === "new" ? "Create" : "Submit for review";
  const editorLanguage = languages[0] ?? problem?.type ?? "JAVA";
  const previewLanguage = languages[0];
  const previewDifficultyClass = difficulty
    ? difficultyStyles[difficulty].preview
    : "border-slate-200 bg-slate-50 text-slate-500";
  const livePreviewContent = (
    <>
      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-[16px] font-bold text-[var(--text-primary)]">{title || "Untitled Problem"}</h4>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-bold text-cyan-700">
            <Clock3 size={12} />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${previewDifficultyClass}`}>
            {difficulty ? displayDifficulty(difficulty) : "Difficulty"}
          </span>
          {previewLanguage ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold ${languageStyles[previewLanguage].selected}`}
            >
              {previewLanguage}
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-bold text-slate-500">
              Language
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Hard
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-bold text-slate-500">
            {examples.length} {examples.length === 1 ? "example" : "examples"}
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
            <dt className="font-semibold text-[var(--text-secondary)]">{label}:</dt>
            <dd className="text-[var(--text-primary)]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2.5">
        {readinessItems.map((item) => (
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]" key={item.label}>
            {item.complete ? (
              <Check className="text-emerald-600" size={18} strokeWidth={2.5} />
            ) : (
              <Circle className="text-slate-400" size={17} />
            )}
            {item.label}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/40 !p-0 font-['Inter',system-ui,sans-serif] text-[14px] text-slate-900 backdrop-blur-sm md:!p-4 lg:!p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-label={dialogTitle}
        aria-modal="true"
        className="relative grid h-screen w-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-none border-0 border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xl shadow-slate-900/10 md:h-[92vh] md:w-[92vw] md:rounded-xl md:border lg:h-[min(800px,90vh)] lg:w-[min(1100px,90vw)]"
        role="dialog"
      >
        <button
          aria-label={`Close ${dialogTitle.toLowerCase()}`}
          className="absolute left-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--border)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35 md:h-8 md:w-8"
          onClick={onClose}
          type="button"
        >
          <X size={20} strokeWidth={2.25} />
        </button>
        <header className="relative flex h-16 items-center justify-between border-b border-[var(--border)] px-5 pl-16 md:h-14 md:pl-14">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[20px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">{dialogTitle}</h2>
            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-bold text-[#3B82F6]">
              {completionPercent}%
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--bg-elevated)]" aria-hidden="true">
            <div
              className="h-full bg-[#3B82F6] transition-[width] duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </header>

        <div className="edit-problem-modal__body grid min-h-0 overflow-y-auto overflow-x-hidden bg-[var(--bg-elevated)] md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] md:divide-x md:divide-[var(--border)]">
          <details className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg text-[14px] font-bold text-[var(--text-primary)]">
              Preview <ChevronDown size={16} />
            </summary>
            <div className="mt-3 space-y-4">{livePreviewContent}</div>
          </details>

          <main className="min-w-0 bg-[var(--bg-card)] px-4 py-4 md:px-5 md:py-5">
            <div className="space-y-4 pb-4">
              <div className="space-y-3">
                <label className="grid gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-500">Title</span>
                  <input
                    aria-label="Problem title"
                    className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-0 text-[14px] font-semibold !text-slate-950 !shadow-none outline-none transition focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    placeholder="e.g. Two Sum"
                    value={title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                  />
                  <FieldError message={rootFieldError("title")} />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-500">Slug</span>
                  <input
                    aria-label="Problem slug"
                    className="!h-10 !w-full !rounded-lg !border !border-slate-300 !bg-slate-100 !px-3 !py-0 font-mono text-[13px] !text-slate-700 !shadow-none outline-none transition placeholder:text-slate-400 focus:!border-[#3B82F6] focus:!bg-white focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    placeholder="auto-generated-from-title"
                    value={slug}
                    onChange={(event) => {
                      setSlugWasEdited(true);
                      setSlug(slugifyTitle(event.target.value));
                    }}
                  />
                  <span className="text-[12px] font-medium text-slate-500">
                    URL-friendly identifier. Auto-generated from the title — edit only if needed.
                  </span>
                  <FieldError message={rootFieldError("slug")} />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {(["JAVA", "SQL"] as ProblemType[]).map((language) => (
                    <button
                      className={`min-h-11 rounded-full border px-4 py-1 text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 md:min-h-0 md:px-3 ${
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
                      className={`min-h-11 rounded-full border px-4 py-1 text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 md:min-h-0 md:px-3 ${
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
                <FieldError message={rootFieldError("languages") ?? rootFieldError("difficulty")} />
                <label className="grid max-w-[14rem] gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-500">Return type</span>
                  <FormSelect
                    ariaLabel="Return type"
                    className="h-10 text-[13px]"
                    options={returnTypeOptions}
                    value={returnType}
                    onValueChange={setReturnType}
                  />
                  <FieldError message={rootFieldError("returnType")} />
                </label>
              </div>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-500">Tags ({tags.length}/{maxTagCount})</span>
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
                        className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-slate-500 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 md:min-h-0 md:min-w-0"
                        onClick={() => removeTag(tag)}
                        type="button"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    aria-label="Add tag"
                    className="!h-7 !w-36 !rounded-full !border !border-slate-200 !bg-white !px-3 !py-0 text-[12px] !shadow-none outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:!bg-slate-100 disabled:!text-slate-400 focus:!border-[#3B82F6] focus:!ring-4 focus:!ring-[#3B82F6]/15"
                    disabled={tagLimitReached}
                    list="problem-tag-options"
                    placeholder="Add tag..."
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      event.preventDefault();
                      const value = event.currentTarget.value.trim();
                      if (value.length > 0 && !tags.includes(value) && tags.length < maxTagCount) {
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
                {tagLimitReached ? (
                  <p className="text-[12px] font-semibold text-amber-600">Maximum 5 tags reached</p>
                ) : null}
                <FieldError message={rootFieldError("tags")} />
              </section>

              <MarkdownEditor
                activeTab={descriptionTab}
                onChange={setDescription}
                onTabChange={setDescriptionTab}
                value={description}
              />
              <FieldError message={rootFieldError("description")} />

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="space-y-3">
                  {examples.length === 0 ? (
                    <p className="text-[13px] font-semibold text-slate-500">No examples yet.</p>
                  ) : null}
                  {examples.map((example, index) => (
                    <article className="relative rounded-lg border border-slate-200 bg-white p-3" key={example.id}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="font-bold text-slate-900">Example {index + 1}</p>
                        <button
                          aria-label={`Remove example ${index + 1}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25"
                          onClick={() => removeExample(index)}
                          type="button"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <label className="grid gap-1.5">
                          <span className="text-[12px] font-semibold text-slate-500">Input</span>
                          <input
                            aria-label={`Example ${index + 1} input`}
                            className="!h-9 !rounded-lg !border !border-slate-200 !bg-white !px-3 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            placeholder="n = 2"
                            value={example.input}
                            onChange={(event) => updateExample(index, "input", event.target.value)}
                          />
                          <FieldError message={exampleFieldError(index, "input")} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[12px] font-semibold text-slate-500">Output</span>
                          <input
                            aria-label={`Example ${index + 1} output`}
                            className="!h-9 !rounded-lg !border !border-slate-200 !bg-white !px-3 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            placeholder="2"
                            value={example.output}
                            onChange={(event) => updateExample(index, "output", event.target.value)}
                          />
                          <FieldError message={exampleFieldError(index, "output")} />
                        </label>
                        <label className="grid gap-1.5">
                          <span className="text-[12px] font-semibold text-slate-500">Explanation</span>
                          <textarea
                            aria-label={`Example ${index + 1} explanation`}
                            className="!min-h-[72px] !rounded-lg !border !border-slate-200 !bg-white !px-3 !py-2 text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15"
                            placeholder="Explain why the output is correct."
                            value={example.explanation}
                            onChange={(event) => updateExample(index, "explanation", event.target.value)}
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:min-h-0"
                    onClick={addExample}
                    type="button"
                  >
                    <Plus size={14} /> Add example
                  </button>
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 font-mono text-[12px] text-slate-600">
                    1 &lt;= n &lt;= 45
                  </span>
                </div>
                <FieldError message={rootFieldError("examples")} />
              </section>

              <CodeEditorCard
                code={starterCode}
                language={editorLanguage}
                onChange={setStarterCode}
                title={editorLanguage}
                titleIcon={null}
              />
              <FieldError message={rootFieldError("starterCode")} />

              <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]">
                <button
                  className="flex min-h-11 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-[13px] font-semibold text-[var(--text-primary)]"
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
                  <div className="border-t border-[var(--border)]">
                    <CodeEditorCard
                      code={referenceSolution}
                      embedded
                      language={editorLanguage}
                      onChange={setReferenceSolution}
                      title={editorLanguage}
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
                    {testCases.map((testCase, index) => {
                      const inputError = testCaseFieldError(index, "input");
                      const expectedError = testCaseFieldError(index, "expectedOutput");

                      return (
                        <tr className="border-b border-slate-100 align-top last:border-0" key={index}>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              <div className="grid gap-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                                <FormSelect
                                  ariaLabel={`Test case ${index + 1} input type`}
                                  className="h-8 text-[12px]"
                                  options={returnTypeOptions}
                                  value={testCase.inputType}
                                  onValueChange={(value) => updateTestCase(index, "inputType", value)}
                                />
                                <input
                                  aria-label={`Test case ${index + 1} input`}
                                  className={`!h-8 !w-full !rounded-lg !border !bg-white !px-2 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15 ${
                                    inputError ? "!border-red-300 focus:!border-red-400 focus:!ring-red-100" : "!border-slate-200"
                                  }`}
                                  value={testCase.input}
                                  onChange={(event) => updateTestCase(index, "input", event.target.value)}
                                />
                              </div>
                              {inputError ? <p className="text-[11px] font-semibold text-red-600">{inputError}</p> : null}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              <div className="grid gap-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
                                <FormSelect
                                  ariaLabel={`Test case ${index + 1} expected output type`}
                                  className="h-8 text-[12px]"
                                  disabled
                                  options={returnTypeOptions}
                                  value={returnType}
                                  onValueChange={() => undefined}
                                />
                                <input
                                  aria-label={`Test case ${index + 1} expected output`}
                                  className={`!h-8 !w-full !rounded-lg !border !bg-white !px-2 !py-0 font-mono text-[13px] !shadow-none outline-none focus:!border-[#3B82F6] focus:!ring-2 focus:!ring-[#3B82F6]/15 ${
                                    expectedError ? "!border-red-300 focus:!border-red-400 focus:!ring-red-100" : "!border-slate-200"
                                  }`}
                                  value={testCase.expectedOutput}
                                  onChange={(event) => updateTestCase(index, "expectedOutput", event.target.value)}
                                />
                              </div>
                              {expectedError ? <p className="text-[11px] font-semibold text-red-600">{expectedError}</p> : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              aria-label={`Toggle hidden for test case ${index + 1}`}
                              className={`relative inline-flex h-8 w-12 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:h-5 md:w-9 ${
                                testCase.hidden ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                              onClick={() => updateTestCase(index, "hidden", !testCase.hidden)}
                              type="button"
                            >
                              <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                                  testCase.hidden ? "left-7 md:left-[18px]" : "left-0.5"
                                }`}
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t border-slate-100 p-3">
                  <button
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:min-h-0"
                    onClick={addTestCase}
                    type="button"
                  >
                    <Plus size={14} /> Add test case
                  </button>
                  <FieldError message={rootFieldError("testCases")} />
                </div>
              </section>
            </div>
          </main>

          <aside className="hidden min-w-0 bg-[var(--bg-elevated)] px-4 py-4 md:block md:px-5 md:py-5">
            <div className="sticky top-4 min-w-0 space-y-4">
              <h3 className="text-[18px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">Live Preview</h3>
              {livePreviewContent}
            </div>
          </aside>
        </div>

        <footer className="flex min-h-[60px] flex-col items-stretch justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 md:flex-row md:items-center md:px-5">
          <div className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-700">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-white">
              <CheckCircle2 size={14} />
            </span>
            <span className="text-slate-500">{autosaveText}</span>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
            <button
              className="order-3 min-h-11 rounded-lg px-3 py-2 text-[14px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:order-1 md:min-h-0"
              type="button"
            >
              Discard
            </button>
            <button
              className="order-2 min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/25 md:min-h-0"
              type="button"
            >
              Save as draft
            </button>
            <button
              className="order-1 min-h-11 rounded-lg bg-[#3B82F6] px-4 py-2 text-[14px] font-bold text-white shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-[#3B82F6]/25 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 md:order-3 md:min-h-0"
              disabled={!isFormValid}
              title={submitDisabledReason}
              type="button"
            >
              {primaryActionLabel}
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
  language: ProblemType;
  onChange: (value: string) => void;
  title: string;
  titleIcon: ReactNode;
};

function CodeEditorCard({ code, embedded = false, language, onChange, title, titleIcon }: CodeEditorCardProps) {
  const { theme } = useAppTheme();

  return (
    <section
      className={`${embedded ? "rounded-none border-0" : "overflow-hidden rounded-xl border border-[var(--border)]"} bg-[var(--bg-card)] text-[var(--text-primary)]`}
    >
      {!embedded ? (
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-[12px] font-bold text-[var(--text-primary)]">
            {titleIcon}
            {title}
          </span>
          <div className="flex items-center gap-1">
            {[Copy, Expand, Settings, ChevronDown].map((Icon, index) => (
              <button
                aria-label={`Code editor control ${index + 1}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
                key={`${Icon.displayName ?? Icon.name}-${index}`}
                onClick={() => {
                  if (Icon === Copy) {
                    void navigator.clipboard?.writeText(code);
                  }
                }}
                type="button"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={embedded ? "min-h-[170px]" : "min-h-[190px]"} style={{ backgroundColor: "var(--bg-card)" }}>
        <Editor
          beforeMount={configureMonacoTheme}
          height={embedded ? "170px" : "190px"}
          language={editorLanguageFor(language)}
          options={{
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            cursorBlinking: "smooth",
            fontFamily: "Chakra Petch, SFMono-Regular, monospace",
            fontLigatures: true,
            fontSize: 12,
            lineHeight: 20,
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            matchBrackets: "always",
            minimap: { enabled: false },
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            padding: { top: 12, bottom: 12 },
            quickSuggestions: true,
            scrollBeyondLastLine: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              horizontalScrollbarSize: 8,
              verticalScrollbarSize: 8,
            },
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            tabCompletion: "on",
            wordBasedSuggestions: "currentDocument",
            wordWrap: "on",
          }}
          theme={theme === "dark" ? "juro-author-dark" : "juro-author-light"}
          value={code}
          onChange={(value) => onChange(value ?? "")}
        />
      </div>
    </section>
  );
}

function ProblemDetailPage() {
  const { problemId = "" } = useParams();
  const { theme } = useAppTheme();
  const [documentTab, setDocumentTab] = useState<DocumentTab>("description");
  const [resultPanelMode, setResultPanelMode] = useState<ResultPanelMode>("testcase");
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [testResult, setTestResult] = useState<Submission | null>(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const [editorValue, setEditorValue] = useState("");
  const [workspaceLanguage, setWorkspaceLanguage] = useState<ProblemType>("JAVA");
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
          setWorkspaceLanguage(problemResponse.type);
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
        submittedLanguage: workspaceLanguage,
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
  const workspaceStatus = problem ? statusForProblem(problem) : "NOT_STARTED";
  const constraintItems = constraintItemsFromMarkdown(problem?.constraintsMarkdown);

  return (
    <section className="viewport-page viewport-page--workspace">
      <div className="workspace-shell workspace-shell--detail">
        <header className="workspace-detail-header glass-panel">
          <div className="problem-bank-header__bar">
            <Link aria-label="Back to Problem Bank" className="icon-button" to="/">
              ←
            </Link>
            <h1>{title}</h1>
            <div className="problem-bank-header__actions">
              <ThemeToggleButton />
              <button aria-label="Settings" className="icon-button" type="button">
                <Settings size={17} strokeWidth={2.25} />
              </button>
            </div>
          </div>
          <div className="workspace-detail-header__summary">
            <p>{description}</p>
            {problem ? (
              <div className="workspace-detail-header__pills">
                <span className={`status-label status-label--${workspaceStatus.toLowerCase().replace("_", "-")}`}>
                  <span className="status-label__mark" aria-hidden="true">
                    {statusMeta[workspaceStatus].mark}
                  </span>
                  {statusMeta[workspaceStatus].label}
                </span>
                <span className={`tag tag--difficulty tag--${problem.difficulty.toLowerCase()}`}>
                  {displayDifficulty(problem.difficulty)}
                </span>
              </div>
            ) : null}
          </div>
        </header>

        {isLoading ? <div className="empty-state">Loading problem…</div> : null}
        {error && !problem ? <div className="error-banner">{error}</div> : null}

        {!isLoading && problem ? (
          <section className="workspace-frame glass-panel">
            <div className="workspace-layout">
            <PanelGroup autoSaveId="problem-workspace-horizontal" direction="horizontal">
              <Panel defaultSize={46} minSize={30}>
                <section className="workspace-pane workspace-card">
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
                            {constraintItems.length > 0 ? (
                              <div className="constraint-list">
                                {constraintItems.map((constraint) => (
                                  <code className="constraint-pill" key={constraint}>
                                    {constraint}
                                  </code>
                                ))}
                              </div>
                            ) : (
                              <MarkdownBlock content={problem.constraintsMarkdown} />
                            )}
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
                    <section className="workspace-pane workspace-card">
                      <div className="workspace-pane__header">
                        <div>
                          <h2 className="workspace-pane__title">Write your solution</h2>
                        </div>

                        <div className="editor-toolbar">
                          <div className="workspace-language-switch" aria-label="Language">
                            {(["JAVA", "SQL"] as ProblemType[]).map((language) => (
                              <button
                                className={`workspace-language-switch__item${
                                  workspaceLanguage === language ? " workspace-language-switch__item--active" : ""
                                }`}
                                key={language}
                                onClick={() => setWorkspaceLanguage(language)}
                                type="button"
                              >
                                {language}
                              </button>
                            ))}
                          </div>
                          <button className="button button--primary button--sm" onClick={handleTestCode} type="button">
                            {isTesting ? "Testing…" : "Test Code"}
                          </button>
                        </div>
                      </div>

                      <div className="editor-shell">
                        <Editor
                          beforeMount={configureMonacoTheme}
                          height="100%"
                          language={editorLanguageFor(workspaceLanguage)}
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
                          theme={theme === "dark" ? "juro-author-dark" : "juro-author-light"}
                          value={editorValue}
                        />
                      </div>
                    </section>
                  </Panel>

                  <PanelResizeHandle className="resize-handle resize-handle--horizontal" />

                  <Panel defaultSize={26} minSize={20}>
                    <section className="workspace-pane workspace-card">
                      <div className="workspace-pane__header">
                        <div>
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
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default App;
