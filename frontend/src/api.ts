import type {
  ProblemDetail,
  ProblemRequest,
  ProblemSummary,
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

export function listSubmissions(problemId: string): Promise<Submission[]> {
  return request(`/api/problems/${problemId}/submissions`);
}

export function createSubmission(problemId: string, payload: SubmissionRequest): Promise<Submission> {
  return request(`/api/problems/${problemId}/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
