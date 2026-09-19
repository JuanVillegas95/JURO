import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { CircleHelp, Search, Settings, X } from 'lucide-react';
import { ThemeToggleButton } from '../../app/theme';
import { ErrorMessage } from '../../components/ErrorMessage';
import {
  clearActiveLocalWorkspace,
  createProblemScaffold,
  finishPracticeSession,
  getActivitySummary,
  getActiveLocalWorkspace,
  getTodayQueue,
  heartbeatPracticeSession,
  launchClaudeKnowledgeCheck,
  listProblems,
  openProblemInEditor,
  recordReviewResult,
  runLocalProblemTests,
  startPracticeSession,
  focusProblem,
} from '../../api';
import type {
  ActivitySummary,
  KnowledgeEvaluationResult,
  LocalProblemRunResult,
  LocalProblemWorkspace,
  LocalWorkspaceSettings,
  ProblemDifficulty,
  ReviewState,
  ProblemSummary,
  ProblemType,
  PracticeSession,
  TodayQueue as TodayQueueData,
} from '../../types';
import { AboutHelpDialog } from '../help/AboutHelpDialog';
import { KnowledgeCheckDialog } from '../knowledge-check/KnowledgeCheckDialog';
import { LocalWorkspacePanel } from '../local-workspace/LocalWorkspacePanel';
import { LocalWorkspaceSettingsDialog } from '../local-workspace/LocalWorkspaceSettingsDialog';
import { OnboardingDialog } from '../onboarding/OnboardingDialog';
import { ActivityHeatmap } from './ActivityHeatmap';
import { ProblemActionModal } from './ProblemActionModal';
import { TodayQueue } from './TodayQueue';
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
  reviewDueLabel,
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

type ReviewFilter = "ALL" | "DUE" | "CODE_DUE" | "EXPLANATION_DUE" | "NEW" | "MASTERED";
export function ProblemListPage() {
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const pageSize = useResponsivePageSize(tableBodyRef);
  const [pageIndex, setPageIndex] = useState(0);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [todayQueue, setTodayQueue] = useState<TodayQueueData | null>(null);
  const [isTodayQueueLoading, setIsTodayQueueLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedProblem, setSelectedProblem] = useState<CatalogProblem | null>(null);
  const [showCatalogControlsDialog, setShowCatalogControlsDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("juro.onboarding.dismissed") !== "1";
  });
  const [activeWorkspace, setActiveWorkspace] = useState<LocalProblemWorkspace | null>(null);
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [lastRunResult, setLastRunResult] = useState<LocalProblemRunResult | null>(null);
  const [lastCodingReview, setLastCodingReview] = useState<ReviewState | null>(null);
  const [lastKnowledgeResult, setLastKnowledgeResult] = useState<KnowledgeEvaluationResult | null>(null);
  const [knowledgeProblem, setKnowledgeProblem] = useState<ProblemSummary | null>(null);
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
  }, [refreshToken]);

  useEffect(() => {
    let active = true;
    setIsActivityLoading(true);

    getActivitySummary(365)
      .then((response) => {
        if (active) setActivity(response);
      })
      .catch(() => {
        if (active) setActivity(null);
      })
      .finally(() => {
        if (active) setIsActivityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshToken]);

  useEffect(() => {
    let active = true;
    setIsTodayQueueLoading(true);

    getTodayQueue(8)
      .then((response) => {
        if (active) setTodayQueue(response);
      })
      .catch(() => {
        if (active) setTodayQueue(null);
      })
      .finally(() => {
        if (active) setIsTodayQueueLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshToken]);

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

  useEffect(() => {
    if (!practiceSession || practiceSession.status !== "ACTIVE") {
      return;
    }

    let active = true;
    const sessionId = practiceSession.id;
    async function heartbeat() {
      if (document.visibilityState !== "visible") {
        return;
      }
      try {
        const next = await heartbeatPracticeSession(sessionId);
        if (active) setPracticeSession(next);
      } catch {
        // A lost heartbeat should not interrupt the practice session UI.
      }
    }

    const interval = window.setInterval(() => void heartbeat(), 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [practiceSession]);

  const catalogProblems: CatalogProblem[] = problems.map((problem) => ({
    ...problem,
    avgTimeMinutes: averageTimeForProblem(problem),
    displayTitle: displayProblemTitle(problem.title),
    status: statusForProblem(problem),
    track: trackForProblem(),
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

  function openSolutionVideo(problem: CatalogProblem) {
    if (problem.solutionVideoUrl) {
      window.open(problem.solutionVideoUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function selectProblem(problem: CatalogProblem) {
    if (busyLocalAction) return;
    setBusyLocalAction(true);
    setLocalActionError(null);
    try {
      await focusProblem(problem.id);
      setSelectedProblem(problem);
      setLastCodingReview(null);
      setRefreshToken((current) => current + 1);
    } catch (focusError) {
      setLocalActionError(focusError instanceof Error ? focusError.message : "Unable to set the current problem.");
    } finally {
      setBusyLocalAction(false);
    }
  }

  function startTodayProblem(problemId: string) {
    const problem = catalogProblems.find((item) => item.id === problemId);
    if (problem) {
      void selectProblem(problem);
    }
  }

  async function ensureCodingSession(problemId: string) {
    if (practiceSession?.status === "ACTIVE" && practiceSession.problemId === problemId) {
      return practiceSession;
    }
    const session = await startPracticeSession(problemId, "CODING");
    setPracticeSession(session);
    return session;
  }

  async function openKnowledgeCheck(problem: ProblemSummary) {
    if (busyLocalAction) {
      return;
    }

    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      const launch = await launchClaudeKnowledgeCheck(problem.id);
      setRefreshToken((current) => current + 1);
      if (launch.launched && launch.copied) {
        return;
      }
      setLocalActionError(launch.message);
      setKnowledgeProblem(problem);
    } catch (launchError) {
      setLocalActionError(launchError instanceof Error ? launchError.message : "Claude could not be opened. Use the manual knowledge check.");
      setKnowledgeProblem(problem);
    } finally {
      setBusyLocalAction(false);
    }
  }

  async function openProblemWorkspace(problem: CatalogProblem) {
    if (busyLocalAction) {
      return;
    }

    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      const workspace = await openProblemInEditor(problem.id);
      setActiveWorkspace(workspace);
      setLastRunResult(null);
      setLastCodingReview(null);
      setLastKnowledgeResult(null);
      if (workspace.status !== "ERROR") {
        await ensureCodingSession(problem.id);
      }
      setRefreshToken((current) => current + 1);
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
      const workspace = await openProblemInEditor(problemId);
      setActiveWorkspace(workspace);
      setLastKnowledgeResult(null);
      if (workspace.status !== "ERROR") {
        await ensureCodingSession(problemId);
      }
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
      const workspace = await createProblemScaffold(problem.id);
      setActiveWorkspace(workspace);
      setLastRunResult(null);
      setLastCodingReview(null);
      setRefreshToken((current) => current + 1);
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
      setLastCodingReview(null);
      const result = await runLocalProblemTests(problemId, practiceSession?.problemId === problemId ? practiceSession.id : null);
      setLastRunResult(result);
      setRefreshToken((current) => current + 1);
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

    const sessionId = practiceSession?.problemId === problemId && practiceSession.status === "ACTIVE" ? practiceSession.id : null;
    const review = await recordReviewResult(problemId, "CODING", passed, sessionId);
    applyReviewState(problemId, review);
    setLastCodingReview(review);
    if (sessionId) {
      try {
        const finishedSession = await finishPracticeSession(sessionId);
        setPracticeSession(finishedSession);
      } catch {
        // Scheduling the review remains successful even if session finalization is retried later.
      }
    }
    setRefreshToken((current) => current + 1);
    return review;
  }

  async function clearCurrentWorkspace() {
    setBusyLocalAction(true);
    setLocalActionError(null);

    try {
      if (practiceSession?.status === "ACTIVE") {
        try {
          const finishedSession = await finishPracticeSession(practiceSession.id);
          setPracticeSession(finishedSession);
        } catch {
          // The workspace can still be cleared if session finalization is unavailable.
        }
      }
      await clearActiveLocalWorkspace();
      setActiveWorkspace(null);
      setLastRunResult(null);
      setLastCodingReview(null);
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

  function dismissOnboarding() {
    window.localStorage.setItem("juro.onboarding.dismissed", "1");
    setShowOnboarding(false);
  }

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
                        <option value="GO">Go</option>
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

              {hasActiveFilters ? (
                <footer className="catalog-controls-dialog__footer">
                  <span aria-hidden="true" />
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
          {localActionError ? <ErrorMessage className="local-action-error error-banner" error={localActionError} /> : null}

          <TodayQueue
            busy={busyLocalAction}
            isLoading={isTodayQueueLoading}
            onStart={startTodayProblem}
            queue={todayQueue}
          />

          <LocalWorkspacePanel
            activeWorkspace={activeWorkspace}
            codingReview={lastCodingReview}
            isBusy={busyLocalAction}
            lastKnowledgeResult={lastKnowledgeResult}
            lastRunResult={lastRunResult}
            onClear={() => void clearCurrentWorkspace()}
            onFinishSession={() => void clearCurrentWorkspace()}
            onGradeCoding={gradeActiveCodingReview}
            onKnowledgeCheck={() => {
              const problem = problems.find((item) => item.id === activeWorkspace?.problemId);
              if (problem) {
                void openKnowledgeCheck(problem);
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
            </div>

            <div className="catalog-table__body" ref={tableBodyRef}>
              {isLoading ? <div className="empty-state">Loading problems…</div> : null}
              {error ? <ErrorMessage className="error-banner" error={error} /> : null}
              {!isLoading && !error && pagedProblems.length === 0 ? (
                <div className="empty-state">No problems match the current filters.</div>
              ) : null}

              {pagedProblems.map((problem) => (
                <div
                  className="catalog-row"
                  key={problem.id}
                  onClick={() => void selectProblem(problem)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void selectProblem(problem);
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

                  <div
                    aria-label={`${problem.displayTitle}: ${problem.summary}`}
                    className="catalog-row__cell catalog-row__problem"
                    data-label="Problem"
                    title={problem.summary}
                  >
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
                      <span>Code {reviewLabel(problem.codingReview)}</span>
                      <small>{reviewDueLabel(problem.codingReview)}</small>
                    </span>
                    <span className={`review-pill review-pill--${reviewTone(problem.explanationReview)}`}>
                      <span>Explain {reviewLabel(problem.explanationReview)}</span>
                      <small>{reviewDueLabel(problem.explanationReview)}</small>
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

          <ActivityHeatmap activity={activity} isLoading={isActivityLoading} />
        </section>
      </div>

      {catalogControlsDialog}

      {selectedProblem ? (
        <ProblemActionModal
          problem={selectedProblem}
          busy={busyLocalAction}
          onClose={() => setSelectedProblem(null)}
          onOpenEditor={() => {
            setSelectedProblem(null);
            void openProblemWorkspace(selectedProblem);
          }}
          onRegenerate={() => {
            setSelectedProblem(null);
            void regenerateProblemScaffold(selectedProblem);
          }}
          onExplain={() => {
            setSelectedProblem(null);
            void openKnowledgeCheck(selectedProblem);
          }}
          onSolution={() => openSolutionVideo(selectedProblem)}
        />
      ) : null}

      {showSettingsDialog ? (
        <LocalWorkspaceSettingsDialog
          onClose={() => setShowSettingsDialog(false)}
          onSaved={handleSettingsSaved}
          onRestored={() => {
            setShowSettingsDialog(false);
            setActiveWorkspace(null);
            setPracticeSession(null);
            setLastRunResult(null);
            setLastCodingReview(null);
            setLastKnowledgeResult(null);
            setRefreshToken((current) => current + 1);
          }}
        />
      ) : null}

      {showHelpDialog ? <AboutHelpDialog onClose={() => setShowHelpDialog(false)} /> : null}

      {showOnboarding ? <OnboardingDialog onClose={dismissOnboarding} /> : null}

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
