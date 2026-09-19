import type { ProblemDifficulty, ProblemSummary, ProblemType, ReviewState } from '../../types';

export type ProblemTrack = "Algorithms";
export type CatalogStatus = "SOLVED" | "ATTEMPTED" | "NOT_STARTED";
export type SortKey = "status" | "title" | "language" | "difficulty" | "avgTime" | "updated" | "review";
export type SortDirection = "asc" | "desc";
export type SortPreset = "REVIEW_DESC" | "UPDATED_DESC" | "TITLE_ASC" | "DIFFICULTY_ASC" | "AVG_TIME_ASC" | "CUSTOM";

export type CatalogProblem = ProblemSummary & {
  avgTimeMinutes: number | null;
  displayTitle: string;
  status: CatalogStatus;
  track: ProblemTrack;
};

export const statusMeta: Record<CatalogStatus, { label: string; mark: string }> = {
  SOLVED: { label: "Solved", mark: "●" },
  ATTEMPTED: { label: "Attempted", mark: "◐" },
  NOT_STARTED: { label: "Unsolved", mark: "○" },
};

export const statusRank: Record<CatalogStatus, number> = {
  SOLVED: 0,
  ATTEMPTED: 1,
  NOT_STARTED: 2,
};

export const difficultyRank: Record<ProblemDifficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

export function displayDifficulty(value: ProblemDifficulty) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function displayLanguage(value: ProblemType) {
  const labels: Record<ProblemType, string> = {
    JAVA: "JAVA",
    PYTHON: "Python",
    JAVASCRIPT: "JavaScript",
    GO: "Go",
    CPP: "C++",
  };

  return labels[value];
}

export function trackForProblem(): ProblemTrack {
  return "Algorithms";
}

export function statusForProblem(problem: ProblemSummary): CatalogStatus {
  if (problem.codingReview?.lastResult === "PASSED") {
    return "SOLVED";
  }
  if (problem.codingReview?.lastResult === "FAILED" || problem.codingReview?.repetitions > 0) {
    return "ATTEMPTED";
  }
  return "NOT_STARTED";
}

export function averageTimeForProblem(problem: ProblemSummary) {
  return problem.avgTimeMinutes ?? null;
}

export function displayProblemTitle(title: string) {
  return title.replace(/\s+Lite$/i, "");
}

export function formatAvgTime(value: number | null) {
  return value === null ? "—" : `${value} min`;
}

export function formatCatalogDate(value: string) {
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

export function defaultDirectionForSort(key: SortKey): SortDirection {
  return key === "updated" || key === "review" ? "desc" : "asc";
}

export function sortPresetForConfig(key: SortKey, direction: SortDirection): SortPreset {
  if (key === "review" && direction === "desc") {
    return "REVIEW_DESC";
  }

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

export function configForSortPreset(value: SortPreset): { key: SortKey; direction: SortDirection } | null {
  switch (value) {
    case "REVIEW_DESC":
      return { key: "review", direction: "desc" };
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

export function compareStrings(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function compareCatalogProblems(left: CatalogProblem, right: CatalogProblem, key: SortKey, direction: SortDirection) {
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

  if (key === "review") {
    comparison = reviewPriority(left) - reviewPriority(right);
  }

  if (comparison === 0) {
    return compareStrings(left.displayTitle, right.displayTitle);
  }

  return direction === "asc" ? comparison : -comparison;
}

export function reviewPriority(problem: ProblemSummary) {
  return Math.max(problem.codingReview?.priorityScore ?? 0, problem.explanationReview?.priorityScore ?? 0);
}

export function reviewLabel(review: ReviewState | undefined) {
  if (!review) {
    return "New";
  }

  if (review.status === "NEW") {
    return "New";
  }

  if (review.status === "MASTERED") {
    return "Up to Date";
  }

  const due = new Date(review.dueAt);
  if (Number.isNaN(due.getTime())) {
    return review.status.charAt(0) + review.status.slice(1).toLowerCase();
  }

  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 0 || review.status === "DUE") {
    return "Due";
  }
  if (review.status === "REVIEW") {
    return "Up to Date";
  }
  if (diffDays === 1) {
    return "Tomorrow";
  }
  return `In ${diffDays}d`;
}

export function reviewDueLabel(review: ReviewState | undefined) {
  if (!review) {
    return "Due now";
  }

  const due = new Date(review.dueAt);
  if (Number.isNaN(due.getTime())) {
    return "Due date unavailable";
  }

  const remainingMs = due.getTime() - Date.now();
  if (remainingMs <= 0 || review.status === "DUE") {
    return "Due now";
  }

  const remainingHours = Math.ceil(remainingMs / 3_600_000);
  if (remainingHours < 24) {
    return `Due in ${remainingHours}h`;
  }

  const remainingDays = Math.ceil(remainingMs / 86_400_000);
  if (remainingDays === 1) {
    return "Due tomorrow";
  }
  if (remainingDays < 7) {
    return `Due in ${remainingDays}d`;
  }

  return `Due ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(due)}`;
}

export function reviewTone(review: ReviewState | undefined) {
  if (!review || review.status === "NEW") {
    return "new";
  }
  if (review.status === "DUE") {
    return "due";
  }
  if (review.status === "MASTERED") {
    return "mastered";
  }
  if (review.lastResult === "FAILED") {
    return "failed";
  }
  return "review";
}

export function paginationItems(totalPages: number, activePage: number) {
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
