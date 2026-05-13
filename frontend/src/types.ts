export type ProblemType = "JAVA" | "PYTHON" | "JAVASCRIPT" | "CPP";
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
  solutionVideoUrl?: string | null;
  knowledgeRubric: string;
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
export type AiProvider = "OLLAMA" | "CODEX_ADAPTER" | "ANTHROPIC";
export type TranscriptionProvider = "BROWSER" | "MANUAL";
export type SchedulerAlgorithm = "SM2";
export type ReviewIntensity = "LIGHT" | "BALANCED" | "AGGRESSIVE";
export type ReviewFrequency = "LESS_OFTEN" | "BALANCED" | "MORE_OFTEN";
export type PracticeFocus = "CODE_HEAVY" | "BALANCED" | "EXPLANATION_HEAVY";

export interface LocalWorkspaceSettings {
  workspaceDirectory: string;
  editor: LocalEditorPreference;
  customEditorCommand: string;
  aiProvider: AiProvider;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  transcriptionProvider: TranscriptionProvider;
  schedulerAlgorithm: SchedulerAlgorithm;
  reviewIntensity: ReviewIntensity;
  codeReviewFrequency: ReviewFrequency;
  explanationReviewFrequency: ReviewFrequency;
  practiceFocus: PracticeFocus;
  minimumIntervalDays: number;
  maximumCodingIntervalDays: number;
  maximumExplanationIntervalDays: number;
  problemBankSyncEnabled: boolean;
  problemBankSyncFilePath: string;
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
  workspaceConfigured: boolean;
  workspaceWritable: boolean;
  workspaceDirectory: string;
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
  status: "PASSED" | "FAILED" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIMEOUT";
  exitCode: number;
  runtimeMillis: number;
  stdout: string;
  stderr: string;
  caseResults: LocalProblemCaseResult[];
}

export interface LocalAiStatus {
  available: boolean;
  provider: AiProvider;
  baseUrl: string;
  selectedModel: string;
  models: string[];
  message: string;
}

export interface KnowledgeEvaluationResult {
  status: "PASSED" | "NEEDS_REVIEW" | "FAILED" | "ERROR";
  score: number;
  summary: string;
  missingConcepts: string[];
  strengths: string[];
  suggestedReview: string;
  model: string;
  createdAt: string;
}

export interface ProblemBankExport {
  format: "juro.problem-bank";
  version: 1;
  exportedAt: string;
  problems: Array<{
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
    reviewStates: ReviewState[];
    submissions: Array<{
      submittedLanguage: string;
      sourceCode: string;
      status: SubmissionStatus;
      resultSummary: string;
      totalRuntimeMillis?: number | null;
      resultDetailsJson?: string | null;
      createdAt?: string | null;
    }>;
  }>;
}

export interface ProblemBankImportResult {
  created: number;
  updated: number;
  reviewStatesImported: number;
  submissionsImported: number;
}

export interface ProblemBankFileSyncStatus {
  enabled: boolean;
  filePath: string;
  fileExists: boolean;
  lastModifiedAt?: string | null;
  fileSizeBytes?: number | null;
  importInProgress: boolean;
  lastImportedAt?: string | null;
  lastImportSummary?: string | null;
  lastError?: string | null;
  synced: boolean;
}
