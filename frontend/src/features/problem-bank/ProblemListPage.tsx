import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { CircleHelp, ExternalLink, FolderCode, Mic, MoreVertical, Pencil, Play, Plus, RefreshCw, Search, Settings, Trash2, X } from 'lucide-react';
import { ThemeToggleButton } from '../../app/theme';
import {
  clearActiveLocalWorkspace,
  createProblemScaffold,
  deleteProblem as deleteProblemApi,
  getActiveLocalWorkspace,
  getProblemBankFileSyncStatus,
  listProblems,
  openProblemInEditor,
  recordReviewResult,
  runLocalProblemTests,
} from '../../api';
import type {
  KnowledgeEvaluationResult,
  LocalProblemRunResult,
  LocalProblemWorkspace,
  LocalWorkspaceSettings,
  ProblemBankFileSyncStatus,
  ProblemDifficulty,
  ReviewState,
  ProblemSummary,
  ProblemType,
} from '../../types';
import { EditProblemDrawer } from '../problem-authoring/EditProblemDrawer';
import { AboutHelpDialog } from '../help/AboutHelpDialog';
import { KnowledgeCheckDialog } from '../knowledge-check/KnowledgeCheckDialog';
import { LocalWorkspacePanel } from '../local-workspace/LocalWorkspacePanel';
import { LocalWorkspaceSettingsDialog } from '../local-workspace/LocalWorkspaceSettingsDialog';
import {
  averageTimeForProblem,
  compareCatalogProblems,
  configForSortPreset,
  defaultDirectionForSort,
  displayDifficulty,
  displayLanguage,
  displayProblemTitle,
  formatAvgTime,
  formatCatalogDate,
  paginationItems,
  reviewLabel,
  reviewTone,
  sortPresetForConfig,
  statusForProblem,
  statusMeta,
  trackForProblem,
  type CatalogProblem,
  type CatalogStatus,
  type ProblemTrack,
  type SortDirection,
  type SortKey,
  type SortPreset,
} from './catalog';

function getResponsivePageSize(tableBodyHeight?: number) {
  if (typeof window === "undefined") {
    return 12;
  }

  const { innerHeight, innerWidth } = window;
  const rowHeight = innerWidth < 768 ? 148 : 56;
  const fallbackChrome = innerWidth < 768 ? 220 : 96;
  const availableHeight = tableBodyHeight && tableBodyHeight > 0 ? tableBodyHeight : innerHeight - fallbackChrome;
  const availableRows = Math.ceil(Math.max(0, availableHeight) / rowHeight) + 1;
  const minimumRows = innerWidth < 768 ? 4 : innerWidth < 1024 ? 8 : 10;
  const maximumRows = innerWidth < 768 ? 12 : 40;

  return Math.min(maximumRows, Math.max(minimumRows, availableRows));
}

function useResponsivePageSize(tableBodyRef: RefObject<HTMLDivElement | null>) {
  const [pageSize, setPageSize] = useState(() => getResponsivePageSize());

  useEffect(() => {
    let animationFrame: number | null = null;

    function updatePageSize(tableBodyHeight?: number) {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        const nextPageSize = getResponsivePageSize(tableBodyHeight ?? tableBodyRef.current?.clientHeight);
        setPageSize((currentPageSize) => (currentPageSize === nextPageSize ? currentPageSize : nextPageSize));
        animationFrame = null;
      });
    }

    function handleResize() {
      updatePageSize();
    }

    updatePageSize();
    window.addEventListener("resize", handleResize);
    const tableBody = tableBodyRef.current;
    const resizeObserver =
      tableBody && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver((entries) => {
            updatePageSize(entries[0]?.contentRect.height);
          })
        : null;

    if (tableBody && resizeObserver) {
      resizeObserver.observe(tableBody);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [tableBodyRef]);

  return pageSize;
}

function catalogFileSyncLabel(status: ProblemBankFileSyncStatus) {
  if (status.importInProgress) {
    return "JSON syncing";
  }
  if (status.lastError) {
    return "JSON sync error";
  }
  if (status.synced) {
    return "JSON synced";
  }
  return "JSON watching";
}

type ReviewFilter = "ALL" | "DUE" | "CODE_DUE" | "EXPLANATION_DUE" | "NEW" | "MASTERED";
type ActionMenuPosition = { left: number; top: number; width: number };

const actionMenuWidth = 176;
const actionMenuViewportGap = 8;
const actionMenuTriggerGap = 6;

type MockProblemStatus = "solved" | "attempted" | "not_started";
type MockReviewKind = "due" | "new" | "up_to_date";

function mockReviewState(
  track: ReviewState["track"],
  kind: MockReviewKind,
  priorityScore: number,
  lastResult?: ReviewState["lastResult"],
): ReviewState {
  const status: ReviewState["status"] = kind === "due" ? "DUE" : kind === "new" ? "NEW" : "REVIEW";
  return {
    track,
    status,
    dueAt: kind === "due" ? "2026-05-01T10:00:00.000Z" : kind === "new" ? "2026-05-25T10:00:00.000Z" : "2026-07-01T10:00:00.000Z",
    lastReviewedAt: kind === "new" ? null : "2026-04-20T10:00:00.000Z",
    intervalDays: kind === "due" ? 1 : kind === "new" ? 0 : 21,
    easeFactor: 2.5,
    repetitions: lastResult ? 2 : 0,
    lapses: lastResult === "FAILED" ? 1 : 0,
    lastResult,
    priorityScore,
  };
}

function mockCodingResult(status: MockProblemStatus): ReviewState["lastResult"] {
  if (status === "solved") {
    return "PASSED";
  }
  if (status === "attempted") {
    return "FAILED";
  }
  return null;
}

function mockProblem(
  index: number,
  values: {
    title: string;
    summary: string;
    type: ProblemType;
    difficulty: ProblemDifficulty;
    status: MockProblemStatus;
    codingReview: MockReviewKind;
    explanationReview: MockReviewKind;
    avgTimeMinutes: number;
    updatedAt: string;
  },
): ProblemSummary {
  const codingResult = mockCodingResult(values.status);
  const slug = values.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    id: `mock-problem-${index + 1}`,
    slug,
    title: values.title,
    summary: values.summary,
    type: values.type,
    difficulty: values.difficulty,
    avgTimeMinutes: values.avgTimeMinutes,
    exampleCount: 3,
    testCaseCount: values.difficulty === "HARD" ? 8 : values.difficulty === "MEDIUM" ? 6 : 4,
    solutionVideoUrl: null,
    codingReview: mockReviewState("CODING", values.codingReview, values.codingReview === "due" ? 92 - index : 42 - index, codingResult),
    explanationReview: mockReviewState(
      "EXPLANATION",
      values.explanationReview,
      values.explanationReview === "due" ? 86 - index : 34 - index,
      values.explanationReview === "new" ? null : "PASSED",
    ),
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: `${values.updatedAt}T10:00:00.000Z`,
  };
}

const mockProblems: ProblemSummary[] = [
  mockProblem(0, {
    title: "Binary Search",
    summary: "Find a target in a sorted array using logarithmic search.",
    type: "PYTHON",
    difficulty: "EASY",
    status: "solved",
    codingReview: "up_to_date",
    explanationReview: "new",
    avgTimeMinutes: 8,
    updatedAt: "2026-05-08",
  }),
  mockProblem(1, {
    title: "Merge Intervals",
    summary: "Merge overlapping intervals after sorting by start time.",
    type: "JAVA",
    difficulty: "MEDIUM",
    status: "attempted",
    codingReview: "due",
    explanationReview: "up_to_date",
    avgTimeMinutes: 22,
    updatedAt: "2026-05-04",
  }),
  mockProblem(2, {
    title: "Valid Parentheses",
    summary: "Use a stack to validate balanced bracket pairs.",
    type: "JAVASCRIPT",
    difficulty: "EASY",
    status: "not_started",
    codingReview: "new",
    explanationReview: "new",
    avgTimeMinutes: 10,
    updatedAt: "2026-04-29",
  }),
  mockProblem(3, {
    title: "LRU Cache",
    summary: "Design a cache with O(1) get and put operations.",
    type: "CPP",
    difficulty: "HARD",
    status: "attempted",
    codingReview: "due",
    explanationReview: "due",
    avgTimeMinutes: 45,
    updatedAt: "2026-04-22",
  }),
  mockProblem(4, {
    title: "Top K Frequent Elements",
    summary: "Return the most frequent elements using buckets or a heap.",
    type: "PYTHON",
    difficulty: "MEDIUM",
    status: "solved",
    codingReview: "up_to_date",
    explanationReview: "up_to_date",
    avgTimeMinutes: 28,
    updatedAt: "2026-04-18",
  }),
  mockProblem(5, {
    title: "Word Ladder",
    summary: "Find the shortest transformation sequence with BFS.",
    type: "JAVA",
    difficulty: "HARD",
    status: "not_started",
    codingReview: "new",
    explanationReview: "due",
    avgTimeMinutes: 50,
    updatedAt: "2026-04-12",
  }),
  mockProblem(6, {
    title: "Kth Largest Element",
    summary: "Select the kth largest value with heap or quickselect.",
    type: "JAVASCRIPT",
    difficulty: "MEDIUM",
    status: "attempted",
    codingReview: "up_to_date",
    explanationReview: "new",
    avgTimeMinutes: 24,
    updatedAt: "2026-04-08",
  }),
  mockProblem(7, {
    title: "Longest Substring Without Repeating Characters",
    summary: "Track a sliding window over unique characters.",
    type: "CPP",
    difficulty: "MEDIUM",
    status: "solved",
    codingReview: "due",
    explanationReview: "up_to_date",
    avgTimeMinutes: 19,
    updatedAt: "2026-04-02",
  }),
  mockProblem(8, {
    title: "Course Schedule",
    summary: "Detect cycles in prerequisite dependencies.",
    type: "PYTHON",
    difficulty: "MEDIUM",
    status: "attempted",
    codingReview: "due",
    explanationReview: "new",
    avgTimeMinutes: 31,
    updatedAt: "2026-03-27",
  }),
  mockProblem(9, {
    title: "Serialize and Deserialize Binary Tree",
    summary: "Encode and rebuild a binary tree from traversal data.",
    type: "JAVA",
    difficulty: "HARD",
    status: "not_started",
    codingReview: "new",
    explanationReview: "new",
    avgTimeMinutes: 54,
    updatedAt: "2026-03-20",
  }),
  mockProblem(10, {
    title: "Minimum Window Substring",
    summary: "Find the smallest window containing all required characters.",
    type: "JAVASCRIPT",
    difficulty: "HARD",
    status: "attempted",
    codingReview: "due",
    explanationReview: "due",
    avgTimeMinutes: 47,
    updatedAt: "2026-03-14",
  }),
  mockProblem(11, {
    title: "Clone Graph",
    summary: "Deep copy an undirected graph with DFS or BFS.",
    type: "CPP",
    difficulty: "MEDIUM",
    status: "solved",
    codingReview: "up_to_date",
    explanationReview: "up_to_date",
    avgTimeMinutes: 26,
    updatedAt: "2026-03-08",
  }),
  mockProblem(12, {
    title: "Number of Islands",
    summary: "Count connected land components in a grid.",
    type: "PYTHON",
    difficulty: "MEDIUM",
    status: "attempted",
    codingReview: "up_to_date",
    explanationReview: "due",
    avgTimeMinutes: 23,
    updatedAt: "2026-03-01",
  }),
  mockProblem(13, {
    title: "House Robber",
    summary: "Use dynamic programming to maximize non-adjacent gains.",
    type: "JAVA",
    difficulty: "EASY",
    status: "solved",
    codingReview: "up_to_date",
    explanationReview: "new",
    avgTimeMinutes: 12,
    updatedAt: "2026-02-25",
  }),
  mockProblem(14, {
    title: "Coin Change",
    summary: "Compute the fewest coins needed for a target amount.",
    type: "JAVASCRIPT",
    difficulty: "MEDIUM",
    status: "not_started",
    codingReview: "new",
    explanationReview: "new",
    avgTimeMinutes: 34,
    updatedAt: "2026-02-20",
  }),
  mockProblem(15, {
    title: "Implement Trie",
    summary: "Build prefix-tree insert, search, and startsWith APIs.",
    type: "CPP",
    difficulty: "MEDIUM",
    status: "attempted",
    codingReview: "due",
    explanationReview: "up_to_date",
    avgTimeMinutes: 29,
    updatedAt: "2026-02-14",
  }),
  mockProblem(16, {
    title: "Rotting Oranges",
    summary: "Run multi-source BFS to simulate minute-by-minute spread.",
    type: "PYTHON",
    difficulty: "MEDIUM",
    status: "solved",
    codingReview: "up_to_date",
    explanationReview: "up_to_date",
    avgTimeMinutes: 21,
    updatedAt: "2026-02-08",
  }),
  mockProblem(17, {
    title: "Meeting Rooms II",
    summary: "Find the minimum rooms required for overlapping meetings.",
    type: "JAVA",
    difficulty: "MEDIUM",
    status: "attempted",
    codingReview: "due",
    explanationReview: "new",
    avgTimeMinutes: 25,
    updatedAt: "2026-01-31",
  }),
  mockProblem(18, {
    title: "Median of Two Sorted Arrays",
    summary: "Binary search partitions across two sorted arrays.",
    type: "CPP",
    difficulty: "HARD",
    status: "not_started",
    codingReview: "new",
    explanationReview: "due",
    avgTimeMinutes: 55,
    updatedAt: "2026-01-23",
  }),
  mockProblem(19, {
    title: "Sliding Window Maximum",
    summary: "Maintain a monotonic deque for each window maximum.",
    type: "JAVASCRIPT",
    difficulty: "HARD",
    status: "solved",
    codingReview: "up_to_date",
    explanationReview: "up_to_date",
    avgTimeMinutes: 42,
    updatedAt: "2026-01-15",
  }),
];

export function ProblemListPage() {
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const pageSize = useResponsivePageSize(tableBodyRef);
  const [pageIndex, setPageIndex] = useState(0);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [editProblemMode, setEditProblemMode] = useState<"edit" | "new" | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<CatalogProblem | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<ActionMenuPosition | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CatalogProblem | null>(null);
  const [showCatalogControlsDialog, setShowCatalogControlsDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<LocalProblemWorkspace | null>(null);
  const [lastRunResult, setLastRunResult] = useState<LocalProblemRunResult | null>(null);
  const [lastKnowledgeResult, setLastKnowledgeResult] = useState<KnowledgeEvaluationResult | null>(null);
  const [knowledgeProblem, setKnowledgeProblem] = useState<ProblemSummary | null>(null);
  const [fileSyncStatus, setFileSyncStatus] = useState<ProblemBankFileSyncStatus | null>(null);
  const [localActionError, setLocalActionError] = useState<string | null>(null);
  const [busyLocalAction, setBusyLocalAction] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trackFilter, setTrackFilter] = useState<ProblemTrack | "ALL">("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<ProblemDifficulty | "ALL">("ALL");
  const [languageFilter, setLanguageFilter] = useState<ProblemType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<CatalogStatus | "ALL">("ALL");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("review");
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
          setProblems([...response, ...mockProblems]);
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
  }, [refreshToken]);

  useEffect(() => {
    let active = true;
    let lastSeenImportedAt: string | null = null;

    async function refreshFileSyncStatus() {
      try {
        const status = await getProblemBankFileSyncStatus();
        if (!active) {
          return;
        }
        setFileSyncStatus(status);
        if (!status.enabled || !status.lastImportedAt) {
          return;
        }
        if (lastSeenImportedAt === null) {
          lastSeenImportedAt = status.lastImportedAt;
          setRefreshToken((current) => current + 1);
          return;
        }
        if (status.lastImportedAt !== lastSeenImportedAt) {
          lastSeenImportedAt = status.lastImportedAt;
          setRefreshToken((current) => current + 1);
        }
      } catch {
        if (active) {
          setFileSyncStatus(null);
        }
      }
    }

    void refreshFileSyncStatus();
    const interval = window.setInterval(refreshFileSyncStatus, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function refreshActiveWorkspace() {
      try {
        const workspace = await getActiveLocalWorkspace();
        if (!active) {
          return;
        }
        if (!workspace.problemId || workspace.status === "NOT_OPEN" || workspace.status === "CLOSED") {
          setActiveWorkspace(null);
          return;
        }
        setActiveWorkspace(workspace);
      } catch {
        if (active) {
          setActiveWorkspace(null);
        }
      }
    }

    void refreshActiveWorkspace();
    const interval = window.setInterval(refreshActiveWorkspace, 3500);
    return () => {
      active = false;
      window.clearInterval(interval);
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
    const matchesReview =
      reviewFilter === "ALL" ||
      (reviewFilter === "DUE" && (reviewLabel(problem.codingReview) === "Due" || reviewLabel(problem.explanationReview) === "Due")) ||
      (reviewFilter === "CODE_DUE" && reviewLabel(problem.codingReview) === "Due") ||
      (reviewFilter === "EXPLANATION_DUE" && reviewLabel(problem.explanationReview) === "Due") ||
      (reviewFilter === "NEW" && problem.codingReview?.status === "NEW" && problem.explanationReview?.status === "NEW") ||
      (reviewFilter === "MASTERED" &&
        problem.codingReview?.status === "MASTERED" &&
        problem.explanationReview?.status === "MASTERED");
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

    return matchesTrack && matchesDifficulty && matchesLanguage && matchesStatus && matchesReview && matchesSearch;
  });

  const sortedProblems = [...filteredProblems].sort((left, right) =>
    compareCatalogProblems(left, right, sortKey, sortDirection),
  );
  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedProblems = sortedProblems.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);
  const activeActionMenuProblem = openActionMenuId
    ? pagedProblems.find((problem) => problem.id === openActionMenuId) ?? null
    : null;
  const hasActiveFilters =
    trackFilter !== "ALL" ||
    difficultyFilter !== "ALL" ||
    languageFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    reviewFilter !== "ALL";
  const sortSelectValue = sortPresetForConfig(sortKey, sortDirection);
  const tableHeaders: Array<{ key: SortKey; label: string; align?: "left" | "right" }> = [
    { key: "status", label: "Status" },
    { key: "title", label: "Problem" },
    { key: "language", label: "Language" },
    { key: "difficulty", label: "Difficulty" },
    { key: "review", label: "Review" },
    { key: "avgTime", label: "Avg Time", align: "right" },
    { key: "updated", label: "Updated", align: "right" },
  ];

  useEffect(() => {
    if (!openActionMenuId) {
      return;
    }

    function closeMenu() {
      closeActionMenu();
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-action-menu-root]")) {
        return;
      }

      closeActionMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeActionMenu();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
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
    if (!showCatalogControlsDialog) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowCatalogControlsDialog(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showCatalogControlsDialog]);

  useEffect(() => {
    setPageIndex(0);
  }, [difficultyFilter, languageFilter, pageSize, reviewFilter, searchQuery, statusFilter, trackFilter]);

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
    setReviewFilter("ALL");
  }

  function openNewProblemModal() {
    setSelectedProblem(null);
    setEditProblemMode("new");
  }

  function closeActionMenu() {
    setOpenActionMenuId(null);
    setActionMenuPosition(null);
  }

  function getActionMenuPosition(trigger: HTMLButtonElement): ActionMenuPosition {
    const rect = trigger.getBoundingClientRect();
    const estimatedMenuHeight = window.innerWidth < 768 ? 322 : 250;
    const maxLeft = Math.max(actionMenuViewportGap, window.innerWidth - actionMenuWidth - actionMenuViewportGap);
    const left = Math.min(Math.max(actionMenuViewportGap, rect.right - actionMenuWidth), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom - actionMenuViewportGap;
    const spaceAbove = rect.top - actionMenuViewportGap;
    const shouldOpenBelow = spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove;
    const preferredTop = shouldOpenBelow
      ? rect.bottom + actionMenuTriggerGap
      : rect.top - estimatedMenuHeight - actionMenuTriggerGap;
    const maxTop = Math.max(actionMenuViewportGap, window.innerHeight - estimatedMenuHeight - actionMenuViewportGap);
    const top = Math.min(Math.max(actionMenuViewportGap, preferredTop), maxTop);

    return { left, top, width: actionMenuWidth };
  }

  function toggleActionMenu(problemId: string, trigger: HTMLButtonElement) {
    if (openActionMenuId === problemId) {
      closeActionMenu();
      return;
    }

    setOpenActionMenuId(problemId);
    setActionMenuPosition(getActionMenuPosition(trigger));
  }

  function openEditProblemModal(problem: CatalogProblem) {
    setSelectedProblem(problem);
    setEditProblemMode("edit");
    closeActionMenu();
  }

  function openSolutionVideo(problem: CatalogProblem) {
    if (problem.solutionVideoUrl) {
      window.open(problem.solutionVideoUrl, "_blank", "noopener,noreferrer");
    }
    closeActionMenu();
  }

  function openKnowledgeCheck(problem: ProblemSummary) {
    setKnowledgeProblem(problem);
    closeActionMenu();
  }

  function isMockProblemId(problemId: string) {
    return problemId.startsWith("mock-problem-");
  }

  function mockWorkspaceForProblem(problem: CatalogProblem): LocalProblemWorkspace {
    return {
      problemId: problem.id,
      title: problem.displayTitle,
      slug: problem.slug,
      scaffoldPath: `/Users/villegas/juro-workspace/${problem.slug}`,
      editor: "VS_CODE",
      opened: true,
      status: "OPEN",
      processId: null,
      closeDetectionAvailable: true,
      launchedAt: new Date().toISOString(),
      message: "",
    };
  }

  function mockRunResultForProblem(problem: CatalogProblem): LocalProblemRunResult {
    const passed = problem.status === "SOLVED";
    return {
      problemId: problem.id,
      title: problem.displayTitle,
      slug: problem.slug,
      scaffoldPath: `/Users/villegas/juro-workspace/${problem.slug}`,
      status: passed ? "PASSED" : "FAILED",
      exitCode: passed ? 0 : 1,
      runtimeMillis: (problem.avgTimeMinutes ?? 20) * 35,
      stdout: passed ? "All sample cases passed." : "Sample case failed.",
      stderr: "",
      caseResults: [
        {
          label: "Sample 1",
          passed,
          inputData: "[1,2,3]",
          expectedOutput: "true",
          actualOutput: passed ? "true" : "false",
          note: passed ? "Matches expected output." : "Mock failure for UI testing.",
          runtimeMillis: 12,
        },
        {
          label: "Sample 2",
          passed: true,
          inputData: "[4,5,6]",
          expectedOutput: "true",
          actualOutput: "true",
          note: "Matches expected output.",
          runtimeMillis: 15,
        },
      ],
    };
  }

  function closeEditProblemModal() {
    setEditProblemMode(null);
    setSelectedProblem(null);
  }

  async function confirmDeleteProblem() {
    if (!deleteCandidate) {
      return;
    }

    try {
      await deleteProblemApi(deleteCandidate.id);
      setProblems((current) => current.filter((problem) => problem.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (deleteError) {
      setLocalActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete problem.");
    }
  }

  async function openProblemWorkspace(problem: CatalogProblem) {
    if (busyLocalAction) {
      return;
    }

    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      if (isMockProblemId(problem.id)) {
        setActiveWorkspace(mockWorkspaceForProblem(problem));
        setLastRunResult(null);
        setLastKnowledgeResult(null);
        closeActionMenu();
        return;
      }

      const workspace = await openProblemInEditor(problem.id);
      setActiveWorkspace(workspace);
      setLastRunResult(null);
      setLastKnowledgeResult(null);
      closeActionMenu();
    } catch (workspaceError) {
      setLocalActionError(
        workspaceError instanceof Error ? workspaceError.message : "Unable to open the local problem workspace.",
      );
    } finally {
      setBusyLocalAction(false);
    }
  }

  async function reopenActiveWorkspace() {
    const problemId = activeWorkspace?.problemId ?? lastRunResult?.problemId;
    if (!problemId || busyLocalAction) {
      return;
    }

    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      if (isMockProblemId(problemId)) {
        const problem = catalogProblems.find((item) => item.id === problemId);
        if (problem) {
          setActiveWorkspace(mockWorkspaceForProblem(problem));
        }
        setLastKnowledgeResult(null);
        return;
      }

      const workspace = await openProblemInEditor(problemId);
      setActiveWorkspace(workspace);
      setLastKnowledgeResult(null);
    } catch (workspaceError) {
      setLocalActionError(
        workspaceError instanceof Error ? workspaceError.message : "Unable to open the local problem workspace.",
      );
    } finally {
      setBusyLocalAction(false);
    }
  }

  async function regenerateProblemScaffold(problem: CatalogProblem) {
    if (busyLocalAction) {
      return;
    }

    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      if (isMockProblemId(problem.id)) {
        setActiveWorkspace(mockWorkspaceForProblem(problem));
        setLastRunResult(null);
        closeActionMenu();
        return;
      }

      const workspace = await createProblemScaffold(problem.id);
      setActiveWorkspace(workspace);
      setLastRunResult(null);
      closeActionMenu();
    } catch (workspaceError) {
      setLocalActionError(
        workspaceError instanceof Error ? workspaceError.message : "Unable to regenerate the local problem scaffold.",
      );
    } finally {
      setBusyLocalAction(false);
    }
  }

  async function runProblemTests(problemId = activeWorkspace?.problemId ?? lastRunResult?.problemId) {
    if (!problemId || busyLocalAction) {
      return;
    }

    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      if (isMockProblemId(problemId)) {
        const problem = catalogProblems.find((item) => item.id === problemId);
        if (problem) {
          setLastRunResult(mockRunResultForProblem(problem));
          setActiveWorkspace((current) => current ?? mockWorkspaceForProblem(problem));
        }
        return;
      }

      const result = await runLocalProblemTests(problemId);
      setLastRunResult(result);
      setActiveWorkspace((current) =>
        current?.problemId === result.problemId
          ? current
          : {
              problemId: result.problemId,
              title: result.title,
              slug: result.slug,
              scaffoldPath: result.scaffoldPath,
              editor: "VS_CODE",
              opened: false,
              status: "READY",
              processId: null,
              closeDetectionAvailable: false,
              launchedAt: null,
              message: "Scaffold tested.",
            },
      );
      closeActionMenu();
    } catch (runError) {
      setLocalActionError(runError instanceof Error ? runError.message : "Unable to run local problem tests.");
    } finally {
      setBusyLocalAction(false);
    }
  }

  function applyReviewState(problemId: string, review: ReviewState) {
    setProblems((current) =>
      current.map((problem) => {
        if (problem.id !== problemId) {
          return problem;
        }
        return review.track === "CODING"
          ? { ...problem, codingReview: review }
          : { ...problem, explanationReview: review };
      }),
    );
  }

  async function gradeActiveCodingReview(passed: boolean) {
    const problemId = activeWorkspace?.problemId ?? lastRunResult?.problemId;
    if (!problemId) {
      throw new Error("Open or run a problem before grading the coding review.");
    }

    const review = await recordReviewResult(problemId, "CODING", passed);
    applyReviewState(problemId, review);
    return review;
  }

  async function clearCurrentWorkspace() {
    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      await clearActiveLocalWorkspace();
      setActiveWorkspace(null);
      setLastRunResult(null);
      setLastKnowledgeResult(null);
    } catch (clearError) {
      setLocalActionError(clearError instanceof Error ? clearError.message : "Unable to clear the active problem.");
    } finally {
      setBusyLocalAction(false);
    }
  }

  function handleSettingsSaved(_settings: LocalWorkspaceSettings) {
    setLocalActionError(null);
  }

  const floatingActionMenu =
    activeActionMenuProblem && actionMenuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            className="action-menu action-menu--floating"
            data-action-menu-root
            role="menu"
            style={{
              left: actionMenuPosition.left,
              top: actionMenuPosition.top,
              width: actionMenuPosition.width,
            }}
          >
            <button
              className="action-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                void openProblemWorkspace(activeActionMenuProblem);
              }}
              role="menuitem"
              type="button"
            >
              <FolderCode size={14} />
              Open in Editor
            </button>
            <button
              className="action-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                void regenerateProblemScaffold(activeActionMenuProblem);
              }}
              role="menuitem"
              type="button"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
            <button
              className="action-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                void runProblemTests(activeActionMenuProblem.id);
              }}
              role="menuitem"
              type="button"
            >
              <Play size={14} />
              Run Tests
            </button>
            <button
              className="action-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                openKnowledgeCheck(activeActionMenuProblem);
              }}
              role="menuitem"
              type="button"
            >
              <Mic size={14} />
              Knowledge Check
            </button>
            {activeActionMenuProblem.solutionVideoUrl ? (
              <button
                className="action-menu__item"
                onClick={(event) => {
                  event.stopPropagation();
                  openSolutionVideo(activeActionMenuProblem);
                }}
                role="menuitem"
                type="button"
              >
                <ExternalLink size={14} />
                Solution
              </button>
            ) : null}
            <button
              className="action-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                openEditProblemModal(activeActionMenuProblem);
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
                setDeleteCandidate(activeActionMenuProblem);
                closeActionMenu();
              }}
              role="menuitem"
              type="button"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>,
          document.body,
        )
      : null;

  const shownProblemCount = filteredProblems.length;
  const shownProblemCountLabel = `${shownProblemCount} ${shownProblemCount === 1 ? "problem" : "problems"}`;
  const catalogControlsDialog =
    showCatalogControlsDialog && typeof document !== "undefined"
      ? createPortal(
          <div
            className="catalog-controls-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowCatalogControlsDialog(false);
              }
            }}
          >
            <section
              aria-label="Search and filter problems"
              aria-modal="true"
              className="catalog-controls-dialog"
              role="dialog"
            >
              <header className="catalog-controls-dialog__header">
                <div>
                  <h2>Search</h2>
                  <p>{shownProblemCountLabel}</p>
                </div>
                <button
                  aria-label="Close search and filters"
                  className="icon-button"
                  onClick={() => setShowCatalogControlsDialog(false)}
                  type="button"
                >
                  <X size={17} strokeWidth={2.35} />
                </button>
              </header>

              <div className="catalog-controls-dialog__body">
                <label className="catalog-search catalog-controls-dialog__search">
                  <span className="catalog-search__icon" aria-hidden="true" />
                  <input
                    aria-label="Search problems"
                    placeholder="Search problems by name, tag, or topic..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>

                <div className="catalog-controls-grid" aria-label="Problem filters">
                  <label className="catalog-control-field">
                    <span className="catalog-control-field__label">Track</span>
                    <span className={`filter-control${trackFilter !== "ALL" ? " filter-control--active" : ""}`}>
                      <select
                        aria-label="Track"
                        value={trackFilter}
                        onChange={(event) => setTrackFilter(event.target.value as ProblemTrack | "ALL")}
                      >
                        <option value="ALL">Track</option>
                        <option value="Algorithms">Algorithms</option>
                      </select>
                    </span>
                  </label>

                  <label className="catalog-control-field">
                    <span className="catalog-control-field__label">Difficulty</span>
                    <span className={`filter-control${difficultyFilter !== "ALL" ? " filter-control--active" : ""}`}>
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
                    </span>
                  </label>

                  <label className="catalog-control-field">
                    <span className="catalog-control-field__label">Language</span>
                    <span className={`filter-control${languageFilter !== "ALL" ? " filter-control--active" : ""}`}>
                      <select
                        aria-label="Language"
                        value={languageFilter}
                        onChange={(event) => setLanguageFilter(event.target.value as ProblemType | "ALL")}
                      >
                        <option value="ALL">Language</option>
                        <option value="JAVA">JAVA</option>
                        <option value="PYTHON">Python</option>
                        <option value="JAVASCRIPT">JavaScript</option>
                        <option value="CPP">C++</option>
                      </select>
                    </span>
                  </label>

                  <label className="catalog-control-field">
                    <span className="catalog-control-field__label">Review</span>
                    <span className={`filter-control${reviewFilter !== "ALL" ? " filter-control--active" : ""}`}>
                      <select
                        aria-label="Review status"
                        value={reviewFilter}
                        onChange={(event) => setReviewFilter(event.target.value as ReviewFilter)}
                      >
                        <option value="ALL">Review</option>
                        <option value="DUE">Due now</option>
                        <option value="CODE_DUE">Code due</option>
                        <option value="EXPLANATION_DUE">Explain due</option>
                        <option value="NEW">New</option>
                        <option value="MASTERED">Mastered</option>
                      </select>
                    </span>
                  </label>

                  <label className="catalog-control-field">
                    <span className="catalog-control-field__label">Status</span>
                    <span className={`filter-control${statusFilter !== "ALL" ? " filter-control--active" : ""}`}>
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
                    </span>
                  </label>

                  <label className="catalog-control-field">
                    <span className="catalog-control-field__label">Sort</span>
                    <span className="filter-control filter-control--active filter-control--sort">
                      <select
                        aria-label="Sort problems"
                        value={sortSelectValue}
                        onChange={(event) => handleSortPreset(event.target.value as SortPreset)}
                      >
                        <option value="REVIEW_DESC">Sort by: Review priority</option>
                        <option value="UPDATED_DESC">Sort by: Recently updated</option>
                        <option value="TITLE_ASC">Sort by: Problem name</option>
                        <option value="DIFFICULTY_ASC">Sort by: Difficulty</option>
                        <option value="AVG_TIME_ASC">Sort by: Avg time</option>
                        <option disabled value="CUSTOM">
                          Sort by: Custom
                        </option>
                      </select>
                    </span>
                  </label>
                </div>
              </div>

              {fileSyncStatus?.enabled || hasActiveFilters ? (
                <footer className="catalog-controls-dialog__footer">
                  {fileSyncStatus?.enabled ? (
                    <div
                      className={`catalog-sync-status${
                        fileSyncStatus.lastError
                          ? " catalog-sync-status--error"
                          : fileSyncStatus.synced
                            ? " catalog-sync-status--ok"
                            : ""
                      }`}
                      title={fileSyncStatus.lastError ?? fileSyncStatus.filePath}
                    >
                      {catalogFileSyncLabel(fileSyncStatus)}
                    </div>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {hasActiveFilters ? (
                    <button className="clear-filters" onClick={clearFilters} type="button">
                      Clear filters
                    </button>
                  ) : null}
                </footer>
              ) : null}
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <aside className="app-sidebar" aria-label="Application navigation">
        <nav className="app-sidebar__section app-sidebar__section--top" aria-label="Primary actions">
          <button
            aria-label="New Problem"
            className="icon-button"
            onClick={openNewProblemModal}
            type="button"
          >
            <Plus size={17} strokeWidth={2.35} />
          </button>
          <button
            aria-expanded={showCatalogControlsDialog}
            aria-haspopup="dialog"
            aria-label="Search and filter problems"
            className="icon-button"
            onClick={() => setShowCatalogControlsDialog(true)}
            type="button"
          >
            <Search size={17} strokeWidth={2.35} />
          </button>
        </nav>
        <nav className="app-sidebar__section app-sidebar__section--bottom" aria-label="Utility actions">
          <ThemeToggleButton />
          <button
            aria-label="Open help"
            className="icon-button"
            onClick={() => setShowHelpDialog(true)}
            type="button"
          >
            <CircleHelp size={17} strokeWidth={2.25} />
          </button>
          <button
            aria-label="Settings"
            className="icon-button"
            onClick={() => setShowSettingsDialog(true)}
            type="button"
          >
            <Settings size={17} strokeWidth={2.25} />
          </button>
        </nav>
      </aside>

      <section className="viewport-page viewport-page--catalog">
      <div className="catalog-shell">
        <section className="problem-bank-panel">
          {localActionError ? <div className="local-action-error error-banner">{localActionError}</div> : null}

          <LocalWorkspacePanel
            activeWorkspace={activeWorkspace}
            isBusy={busyLocalAction}
            lastKnowledgeResult={lastKnowledgeResult}
            lastRunResult={lastRunResult}
            onClear={() => void clearCurrentWorkspace()}
            onGradeCoding={gradeActiveCodingReview}
            onKnowledgeCheck={() => {
              const problem = problems.find((item) => item.id === activeWorkspace?.problemId);
              if (problem) {
                openKnowledgeCheck(problem);
              }
            }}
            onOpenEditor={() => void reopenActiveWorkspace()}
            onRunTests={() => void runProblemTests()}
          />

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

            <div className="catalog-table__body" ref={tableBodyRef}>
              {isLoading ? <div className="empty-state">Loading problems…</div> : null}
              {error ? <div className="error-banner">{error}</div> : null}
              {!isLoading && !error && pagedProblems.length === 0 ? (
                <div className="empty-state">No problems match the current filters.</div>
              ) : null}

              {pagedProblems.map((problem) => (
                <div
                  className="catalog-row"
                  key={problem.id}
                  onClick={() => void openProblemWorkspace(problem)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openProblemWorkspace(problem);
                    }
                  }}
                  role="button"
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

                  <div className="catalog-row__cell catalog-row__cell--review" data-label="Review">
                    <span className={`review-pill review-pill--${reviewTone(problem.codingReview)}`}>
                      Code {reviewLabel(problem.codingReview)}
                    </span>
                    <span className={`review-pill review-pill--${reviewTone(problem.explanationReview)}`}>
                      Explain {reviewLabel(problem.explanationReview)}
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
                        toggleActionMenu(problem.id, event.currentTarget);
                      }}
                      type="button"
                    >
                      <MoreVertical size={17} strokeWidth={2.3} />
                    </button>
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

      {floatingActionMenu}
      {catalogControlsDialog}

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
          onSaved={() => setRefreshToken((current) => current + 1)}
          problem={selectedProblem}
        />
      ) : null}

      {showSettingsDialog ? (
        <LocalWorkspaceSettingsDialog
          onClose={() => setShowSettingsDialog(false)}
          onProblemBankImported={() => setRefreshToken((current) => current + 1)}
          onSaved={handleSettingsSaved}
        />
      ) : null}

      {showHelpDialog ? <AboutHelpDialog onClose={() => setShowHelpDialog(false)} /> : null}

      {knowledgeProblem ? (
        <KnowledgeCheckDialog
          problem={knowledgeProblem}
          onClose={() => setKnowledgeProblem(null)}
          onEvaluated={(result) => setLastKnowledgeResult(result)}
          onReviewGraded={(review) => {
            applyReviewState(knowledgeProblem.id, review);
            setRefreshToken((current) => current + 1);
          }}
        />
      ) : null}
      </section>
    </>
  );
}
