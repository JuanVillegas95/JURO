import type {
  KnowledgeEvaluationResult,
  ClaudeLaunchResult,
  ActivitySummary,
  TodayQueue,
  McpConfigResponse,
  McpStatus,
  ProblemDetail,
  LocalProblemRunResult,
  LocalProblemWorkspace,
  LocalToolingStatus,
  LocalWorkspaceSettings,
  BackupRestoreResult,
  PracticeSession,
  ProblemProgressHistory,
  ProblemSummary,
  ReviewState,
  ReviewTrack,
  Submission,
  SubmissionRequest,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export interface ApiErrorResponse {
  code?: string;
  message?: string;
  hint?: string;
  requestId?: string;
  details?: string[];
}

export class JuroApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly hint?: string,
    public readonly requestId?: string,
    public readonly status?: number,
  ) {
    super(hint ? `${message} ${hint}` : message);
    this.name = "JuroApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    const message = body?.message || body?.details?.join(" | ") || fallbackStatusMessage(response.status);
    throw new JuroApiError(message, body?.code, body?.hint, body?.requestId, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function requestBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    const message = body?.message || body?.details?.join(" | ") || fallbackStatusMessage(response.status);
    throw new JuroApiError(message, body?.code, body?.hint, body?.requestId, response.status);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return { blob: await response.blob(), filename: match?.[1] ?? `juro-backup-${new Date().toISOString().slice(0, 10)}.sqlite` };
}

function fallbackStatusMessage(status: number): string {
  if (status === 400) return "JURO rejected the request.";
  if (status === 404) return "The requested JURO resource was not found.";
  if (status === 424) return "A local dependency required by JURO is unavailable.";
  if (status === 503) return "A local JURO service is unavailable.";
  return "JURO could not complete the request.";
}

export function listProblems(): Promise<ProblemSummary[]> {
  return request("/api/problems");
}

export function getActivitySummary(days = 365): Promise<ActivitySummary> {
  return request(`/api/local/activity?days=${days}`);
}

export function getTodayQueue(limit = 8): Promise<TodayQueue> {
  return request(`/api/local/today?limit=${limit}`);
}

export function getProblem(id: string): Promise<ProblemDetail> {
  return request(`/api/problems/${id}`);
}

export function getProblemProgressHistory(problemId: string): Promise<ProblemProgressHistory> {
  return request(`/api/problems/${problemId}/progress/history`);
}

export function listSubmissions(problemId: string): Promise<Submission[]> {
  return request(`/api/problems/${problemId}/submissions`);
}

export function createSubmission(problemId: string, payload: SubmissionRequest): Promise<Submission> {
  return request(`/api/problems/${problemId}/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLocalSettings(): Promise<LocalWorkspaceSettings> {
  return request("/api/local/settings");
}

export function saveLocalSettings(payload: LocalWorkspaceSettings): Promise<LocalWorkspaceSettings> {
  return request("/api/local/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getLocalToolingStatus(): Promise<LocalToolingStatus> {
  return request("/api/local/tooling/status");
}

export function getLocalMcpConfig(): Promise<McpConfigResponse> {
  return request("/api/local/mcp/config");
}

export function getLocalMcpStatus(): Promise<McpStatus> {
  return request("/api/local/mcp/status");
}

export function downloadLocalBackup(): Promise<{ blob: Blob; filename: string }> {
  return requestBlob("/api/local/backup/export");
}

export function restoreLocalBackup(file: File): Promise<BackupRestoreResult> {
  return request("/api/local/backup/import", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
}

export function launchClaudeKnowledgeCheck(problemId: string): Promise<ClaudeLaunchResult> {
  return request(`/api/local/problems/${problemId}/claude-knowledge-check`, {
    method: "POST",
  });
}

export function getActiveLocalWorkspace(): Promise<LocalProblemWorkspace> {
  return request("/api/local/workspace/active");
}

export function clearActiveLocalWorkspace(): Promise<LocalProblemWorkspace> {
  return request("/api/local/workspace/active/clear", {
    method: "POST",
  });
}

export function createProblemScaffold(problemId: string): Promise<LocalProblemWorkspace> {
  return request(`/api/local/problems/${problemId}/scaffold`, {
    method: "POST",
  });
}

export function openProblemInEditor(problemId: string): Promise<LocalProblemWorkspace> {
  return request(`/api/local/problems/${problemId}/open-editor`, {
    method: "POST",
  });
}

export function focusProblem(problemId: string): Promise<{ problemId: string; status: string }> {
  return request(`/api/local/problems/${problemId}/focus`, {
    method: "POST",
  });
}

export function runLocalProblemTests(problemId: string, sessionId?: string | null): Promise<LocalProblemRunResult> {
  return request(`/api/local/problems/${problemId}/run-tests`, {
    method: "POST",
    body: JSON.stringify(sessionId ? { sessionId } : {}),
  });
}

export function startPracticeSession(problemId: string, track: ReviewTrack = "CODING"): Promise<PracticeSession> {
  return request("/api/local/sessions", {
    method: "POST",
    body: JSON.stringify({ problemId, track }),
  });
}

export function heartbeatPracticeSession(sessionId: string): Promise<PracticeSession> {
  return request(`/api/local/sessions/${sessionId}/heartbeat`, { method: "POST" });
}

export function finishPracticeSession(sessionId: string): Promise<PracticeSession> {
  return request(`/api/local/sessions/${sessionId}/finish`, { method: "POST" });
}

export function evaluateProblemKnowledge(problemId: string, transcript: string): Promise<KnowledgeEvaluationResult> {
  return request<{ session: { id: string } }>(`/api/problems/${problemId}/knowledge-checks`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  }).then((response) => ({
    status: "PENDING",
    score: 0,
    summary: "Transcript saved. Ask Claude through JURO MCP to run start_knowledge_check and submit_knowledge_check.",
    missingConcepts: [],
    strengths: [],
    suggestedReview: "Open Claude's voice interface with the JURO MCP connector to continue this knowledge check.",
    model: "Claude via JURO MCP",
    createdAt: new Date().toISOString(),
    sessionId: response.session.id,
  } as KnowledgeEvaluationResult));
}

export function recordReviewResult(problemId: string, track: ReviewTrack, passed: boolean, sessionId?: string | null): Promise<ReviewState> {
  return request(`/api/problems/${problemId}/review-results`, {
    method: "POST",
    body: JSON.stringify({ track, passed, ...(sessionId ? { sessionId } : {}) }),
  });
}
