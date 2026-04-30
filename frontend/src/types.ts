export type ProblemType = "JAVA" | "SQL";
export type ProblemDifficulty = "EASY" | "MEDIUM" | "HARD";
export type SubmissionStatus = "QUEUED" | "ACCEPTED" | "REJECTED";

export interface ProblemSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  exampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemExample {
  id?: string;
  label: string;
  sortOrder: number;
  inputData: string;
  expectedOutput: string;
  explanation?: string | null;
  createdAt?: string;
}

export interface ProblemDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  descriptionMarkdown: string;
  constraintsMarkdown?: string | null;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  starterCode?: string | null;
  referenceSolution?: string | null;
  evaluationNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  examples: ProblemExample[];
}

export interface ProblemRequest {
  title: string;
  slug?: string;
  summary: string;
  descriptionMarkdown: string;
  constraintsMarkdown?: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  starterCode?: string;
  referenceSolution?: string;
  evaluationNotes?: string;
  examples: ProblemExample[];
}

export interface SubmissionCaseResult {
  label: string;
  passed: boolean;
  inputData: string;
  expectedOutput: string;
  actualOutput: string;
  note: string;
  runtimeMillis: number;
}

export interface Submission {
  id: string;
  problemId: string;
  submittedLanguage: string;
  status: SubmissionStatus;
  resultSummary: string;
  totalRuntimeMillis?: number | null;
  caseResults: SubmissionCaseResult[];
  createdAt: string;
}

export interface SubmissionRequest {
  submittedLanguage: string;
  sourceCode: string;
}
