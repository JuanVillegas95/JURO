import type {
  KnowledgeEvaluationResult,
  LocalAiStatus,
  ProblemDetail,
  LocalProblemRunResult,
  LocalProblemWorkspace,
  LocalToolingStatus,
  LocalWorkspaceSettings,
  ProblemBankExport,
  ProblemBankFileSyncStatus,
  ProblemBankImportResult,
  ProblemRequest,
  ProblemSummary,
  ReviewState,
  ReviewTrack,
  Submission,
  SubmissionRequest,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

interface ApiErrorResponse {
  details?: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    const message = body?.details?.join(" | ") ?? `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listProblems(): Promise<ProblemSummary[]> {
  return request("/api/problems");
}

export function getProblem(id: string): Promise<ProblemDetail> {
  return request(`/api/problems/${id}`);
}

export function createProblem(payload: ProblemRequest): Promise<ProblemDetail> {
  return request("/api/problems", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProblem(id: string, payload: ProblemRequest): Promise<ProblemDetail> {
  return request(`/api/problems/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteProblem(id: string): Promise<void> {
  await request<void>(`/api/problems/${id}`, {
    method: "DELETE",
  });
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

export function getAiStatus(): Promise<LocalAiStatus> {
  return request("/api/local/ai/status");
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

export function runLocalProblemTests(problemId: string): Promise<LocalProblemRunResult> {
  return request(`/api/local/problems/${problemId}/run-tests`, {
    method: "POST",
  });
}

export function evaluateProblemKnowledge(problemId: string, transcript: string): Promise<KnowledgeEvaluationResult> {
  return request(`/api/problems/${problemId}/knowledge-evaluations`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });
}

export function recordReviewResult(problemId: string, track: ReviewTrack, passed: boolean): Promise<ReviewState> {
  return request(`/api/problems/${problemId}/review-results`, {
    method: "POST",
    body: JSON.stringify({ track, passed }),
  });
}

export function exportProblemBank(): Promise<ProblemBankExport> {
  return request("/api/problem-bank/export");
}

export function importProblemBank(payload: ProblemBankExport): Promise<ProblemBankImportResult> {
  return request("/api/problem-bank/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProblemBankFileSyncStatus(): Promise<ProblemBankFileSyncStatus> {
  return request("/api/problem-bank/file-sync/status");
}

export function writeProblemBankSyncFile(): Promise<ProblemBankFileSyncStatus> {
  return request("/api/problem-bank/file-sync/export", {
    method: "POST",
  });
}

export function importProblemBankSyncFile(): Promise<ProblemBankFileSyncStatus> {
  return request("/api/problem-bank/file-sync/import", {
    method: "POST",
  });
}
