// CPP is retained for legacy records but is not currently executable.
export type ProblemType = "JAVA" | "PYTHON" | "JAVASCRIPT" | "GO" | "CPP";
export type ProblemDifficulty = "EASY" | "MEDIUM" | "HARD";
export type SubmissionStatus = "QUEUED" | "ACCEPTED" | "REJECTED";
export type ReviewTrack = "CODING" | "EXPLANATION";
export type ReviewStatus = "NEW" | "LEARNING" | "REVIEW" | "DUE" | "MASTERED";
export type ReviewResult = "PASSED" | "FAILED";

export interface ReviewState {
  track: ReviewTrack;
  status: ReviewStatus;
  dueAt: string;
  lastReviewedAt?: string | null;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastResult?: ReviewResult | null;
  priorityScore: number;
}

export interface ProblemSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  avgTimeMinutes?: number | null;
  exampleCount: number;
  testCaseCount: number;
  solutionVideoUrl?: string | null;
  codingReview: ReviewState;
  explanationReview: ReviewState;
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

export interface ProblemTestCase {
  id?: string;
  label: string;
  sortOrder: number;
  inputData: string;
  expectedOutput: string;
  hidden: boolean;
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
  solutionVideoUrl?: string | null;
  knowledgeRubric: string;
  createdAt: string;
  updatedAt: string;
  examples: ProblemExample[];
  testCases: ProblemTestCase[];
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

export type LocalEditorPreference = "VS_CODE" | "NVIM";

export interface LocalWorkspaceSettings {
  workspaceDirectory: string;
  editor: LocalEditorPreference;
  editorPath: string;
  javaRuntimePath: string;
  javaCompilerPath: string;
  pythonPath: string;
  nodePath: string;
  goPath: string;
}

export interface BackupRestoreResult {
  restored: true;
  restoredAt: string;
  safetyBackupFile: string;
  summary: {
    problems: number;
    submissions: number;
    reviews: number;
    activityEvents: number;
  };
}

export interface ToolCommandStatus {
  name: string;
  available: boolean;
  version: string;
  detail: string;
}

export interface LocalToolingStatus {
  javaRuntime: ToolCommandStatus;
  javaCompiler: ToolCommandStatus;
  maven: ToolCommandStatus;
  python: ToolCommandStatus;
  node: ToolCommandStatus;
  go: ToolCommandStatus;
  workspaceConfigured: boolean;
  workspaceWritable: boolean;
  workspaceDirectory: string;
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ActivitySummary {
  startDate: string;
  endDate: string;
  totalActivity: number;
  activeDays: number;
  days: ActivityDay[];
}

export type TodayQueueReason = "OVERDUE" | "DUE_TODAY" | "NEW";

export interface TodayQueueItem {
  problemId: string;
  title: string;
  slug: string;
  summary: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  track: ReviewTrack;
  reason: TodayQueueReason;
  dueAt: string;
  priorityScore: number;
  estimatedMinutes: number;
}

export interface TodayQueue {
  date: string;
  completedToday: number;
  totalCandidates: number;
  estimatedMinutes: number;
  items: TodayQueueItem[];
}

export interface LocalProblemWorkspace {
  problemId?: string | null;
  title: string;
  slug: string;
  scaffoldPath: string;
  editor: LocalEditorPreference;
  opened: boolean;
  status: "NOT_OPEN" | "READY" | "OPEN" | "CLOSED" | "ERROR";
  processId?: number | null;
  closeDetectionAvailable: boolean;
  launchedAt?: string | null;
  message: string;
}

export interface LocalProblemCaseResult {
  label: string;
  passed: boolean;
  inputData: string;
  expectedOutput: string;
  actualOutput: string;
  note: string;
  runtimeMillis: number;
}

export interface LocalProblemRunResult {
  problemId: string;
  title: string;
  slug: string;
  scaffoldPath: string;
  status: "PASSED" | "FAILED" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIMEOUT" | "TOOLCHAIN_UNAVAILABLE";
  exitCode: number;
  runtimeMillis: number;
  stdout: string;
  stderr: string;
  caseResults: LocalProblemCaseResult[];
}

export type CodingSessionStage = "STARTED" | "EDITOR_OPEN" | "TESTED" | "GRADED" | "SCHEDULED";

export type PracticeSessionStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";

export interface PracticeSession {
  id: string;
  problemId: string;
  track: ReviewTrack;
  status: PracticeSessionStatus;
  startedAt: string;
  lastHeartbeatAt: string;
  endedAt: string | null;
  activeTimeMillis: number;
  updatedAt: string;
}

export interface TestAttemptHistory {
  id: string;
  problemId: string;
  sessionId: string | null;
  submittedLanguage: string;
  status: string;
  passedCases: number;
  totalCases: number;
  runtimeMillis: number;
  createdAt: string;
}

export interface ReviewHistoryEntry {
  id: string;
  problemId: string;
  sessionId: string | null;
  track: ReviewTrack;
  passed: boolean;
  previousStatus: ReviewStatus | null;
  previousDueAt: string | null;
  newStatus: ReviewStatus;
  newDueAt: string;
  intervalDays: number;
  createdAt: string;
}

export interface KnowledgeCheckHistoryEntry {
  id: string;
  problemId: string;
  sessionId: string | null;
  knowledgeSessionId: string;
  status: KnowledgeEvaluationResult["status"];
  score: number;
  summary: string;
  createdAt: string;
}

export interface ProblemProgressSummary {
  attempts: number;
  passedAttempts: number;
  failedAttempts: number;
  passedTestCases: number;
  totalTestCases: number;
  totalRuntimeMillis: number;
  timeSpentMillis: number;
  reviewGrades: number;
  passedReviews: number;
  failedReviews: number;
  knowledgeChecks: number;
  averageKnowledgeScore: number | null;
  lastActivityAt: string | null;
}

export interface ProblemProgressHistory {
  problemId: string;
  summary: ProblemProgressSummary;
  sessions: PracticeSession[];
  testAttempts: TestAttemptHistory[];
  reviews: ReviewHistoryEntry[];
  knowledgeChecks: KnowledgeCheckHistoryEntry[];
}

export interface McpConfigResponse {
  transport: "stdio";
  configured: boolean;
  command: string;
  args: string[];
  config: Record<string, unknown>;
  configJson: string;
  message: string;
}

export interface McpStatus {
  transport: "stdio";
  available: boolean;
  configured: boolean;
  command: string;
  args: string[];
  serverScript: string;
  message: string;
}

export interface ClaudeLaunchResult {
  launched: boolean;
  copied: boolean;
  prompt: string;
  message: string;
  session: { id: string; problemId: string; status: "STARTED" | "SUBMITTED" };
}

export interface KnowledgeEvaluationResult {
  status: "PENDING" | "PASSED" | "NEEDS_REVIEW" | "FAILED" | "ERROR";
  score: number;
  summary: string;
  missingConcepts: string[];
  strengths: string[];
  suggestedReview: string;
  model: string;
  createdAt: string;
  sessionId?: string;
}
