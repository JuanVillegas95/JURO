import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import { config } from "./config.js";
import { JuroDatabase } from "./db.js";
import { ProblemRepository } from "./repository.js";
import { SettingsStore } from "./settings.js";
import { WorkspaceService } from "./workspace.js";
import { isSupportedLanguage, supportedLanguages } from "./runners.js";
import { localMcpConfig, localMcpStatus } from "./mcp-config.js";
import { knowledgeCheckPrompt, launchClaude } from "./claude.js";
import { classifyError, errorResponse, JuroError, requestIdFor } from "./errors.js";
import { BackupService } from "./backup.js";
import type { KnowledgeEvaluationResult, ReviewTrack } from "./types.js";

const database = new JuroDatabase();
const repository = new ProblemRepository(database);
const settings = new SettingsStore();
const workspace = new WorkspaceService(repository, settings);
const backups = new BackupService(database);
const submissionLanguageSchema = z.string().trim().toUpperCase().refine(isSupportedLanguage, "Language must be JAVA, PYTHON, JAVASCRIPT, or GO.");
const app = Fastify({ logger: process.env.NODE_ENV !== "test", bodyLimit: 100 * 1024 * 1024 });

await app.register(cors, { origin: true });
app.addContentTypeParser(["application/octet-stream", "application/x-sqlite3"], { parseAs: "buffer" }, (_request, body, done) => done(null, body));

// Register the handler before routes so errors thrown by both route handlers
// and Fastify's pre-handler pipeline receive the same actionable response.
app.setErrorHandler((error: Error, request, reply) => {
  const requestId = requestIdFor(request);
  const classified = classifyError(error);
  request.log.error({ err: error, code: classified.code, requestId }, "Request failed");
  return reply.code(classified.statusCode).send(errorResponse(error, requestId));
});

app.get("/health", async () => ({ status: "ok", database: "sqlite", timestamp: new Date().toISOString() }));

app.get("/api/problems", async () => repository.listProblems());

app.get<{ Params: { id: string } }>("/api/problems/:id", async (request) => repository.getProblem(request.params.id));

app.get<{ Params: { problemId: string } }>("/api/problems/:problemId/submissions", async (request) => repository.listSubmissions(request.params.problemId));

app.post<{ Params: { problemId: string }; Body: unknown }>("/api/problems/:problemId/submissions", async (request) => {
  const body = z.object({ submittedLanguage: submissionLanguageSchema, sourceCode: z.string().min(1) }).parse(request.body);
  return submit(request.params.problemId, body.submittedLanguage, body.sourceCode);
});

app.post<{ Body: unknown }>("/api/submissions", async (request) => {
  const body = z.object({ problemId: z.string().min(1), language: submissionLanguageSchema, code: z.string().min(1) }).parse(request.body);
  return submit(body.problemId, body.language, body.code);
});

app.post<{ Params: { problemId: string }; Body: unknown }>("/api/problems/:problemId/knowledge-checks", async (request) => {
  const body = z.object({ transcript: z.string().trim().max(100_000).optional() }).parse(request.body ?? {});
  return {
    session: repository.startKnowledgeCheck(request.params.problemId, body.transcript ?? ""),
    problem: repository.getKnowledgeProblemContext(request.params.problemId),
    instruction: "Send this problem context and rubric to Claude through JURO MCP. Claude should ask the learner questions and call submit_knowledge_check with the structured result.",
  };
});

app.post<{ Params: { problemId: string; sessionId: string }; Body: unknown }>("/api/problems/:problemId/knowledge-checks/:sessionId/submit", async (request) => {
  const body = z.object({
    transcript: z.string().trim().max(100_000).optional(),
    evaluation: z.object({
      status: z.enum(["PASSED", "NEEDS_REVIEW", "FAILED"]),
      score: z.number().min(0).max(100),
      summary: z.string(),
      missingConcepts: z.array(z.string()),
      strengths: z.array(z.string()),
      suggestedReview: z.string(),
      model: z.string().default("Claude via JURO MCP"),
      createdAt: z.string().optional(),
    }),
  }).parse(request.body);
  const evaluation: KnowledgeEvaluationResult = { ...body.evaluation, createdAt: body.evaluation.createdAt ?? new Date().toISOString() };
  return repository.submitKnowledgeCheck({ id: request.params.sessionId, problemId: request.params.problemId, transcript: body.transcript, evaluation });
});

app.post<{ Params: { problemId: string } }>("/api/local/problems/:problemId/focus", async (request) => {
  return repository.setCurrentProblem(request.params.problemId, "FOCUSED");
});

app.post<{ Params: { problemId: string } }>("/api/local/problems/:problemId/claude-knowledge-check", async (request) => {
  const problem = repository.getKnowledgeProblemContext(request.params.problemId);
  const session = repository.startKnowledgeCheck(problem.id);
  const prompt = knowledgeCheckPrompt(problem.id, problem.title, session.id);
  return { session, ...await launchClaude(prompt) };
});

app.post<{ Params: { problemId: string }; Body: unknown }>("/api/problems/:problemId/review-results", async (request) => {
  const body = z.object({ track: z.enum(["CODING", "EXPLANATION"]), passed: z.boolean(), sessionId: z.string().min(1).optional() }).parse(request.body);
  return repository.recordReview(request.params.problemId, body.track as ReviewTrack, body.passed, body.sessionId ?? null);
});

app.get("/api/local/settings", async () => settings.get());

app.put<{ Body: unknown }>("/api/local/settings", async (request) => {
  const body = z.object({
    workspaceDirectory: z.string().optional(),
    editor: z.enum(["VS_CODE", "NVIM"]).optional(),
    editorPath: z.string().optional(),
    javaRuntimePath: z.string().optional(),
    javaCompilerPath: z.string().optional(),
    pythonPath: z.string().optional(),
    nodePath: z.string().optional(),
    goPath: z.string().optional(),
  }).parse(request.body);
  return settings.save(body);
});

app.get("/api/local/tooling/status", async () => workspace.toolingStatus());
app.get("/api/local/languages", async () => supportedLanguages);
app.get<{ Querystring: { days?: string } }>("/api/local/activity", async (request) => {
  const query = z.object({ days: z.coerce.number().int().min(30).max(730).default(365) }).parse(request.query);
  return repository.getActivitySummary(query.days);
});
app.get<{ Querystring: { limit?: string } }>("/api/local/today", async (request) => {
  const query = z.object({ limit: z.coerce.number().int().min(1).max(20).default(8) }).parse(request.query);
  return repository.getTodayQueue(query.limit);
});
app.get("/api/local/mcp/config", async () => localMcpConfig());
app.get("/api/local/mcp/status", async () => localMcpStatus());
app.get("/api/local/backup/export", async (_request, reply) => {
  const snapshotPath = backups.createExportSnapshot();
  const filename = `juro-backup-${new Date().toISOString().slice(0, 10)}.sqlite`;
  const stream = fs.createReadStream(snapshotPath);
  const cleanup = () => backups.cleanupExport(snapshotPath);
  stream.once("close", cleanup);
  stream.once("error", cleanup);
  return reply
    .type("application/vnd.sqlite3")
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(stream);
});
app.post<{ Body: Buffer }>("/api/local/backup/import", async (request) => {
  if (!Buffer.isBuffer(request.body)) {
    throw new JuroError("INVALID_BACKUP", "The backup upload must be a SQLite file.", "Choose a JURO-generated .sqlite backup file.", 400);
  }
  return backups.restoreFromBuffer(request.body);
});
app.get("/api/local/problems/current", async () => repository.getProblemProgress());
app.get<{ Params: { problemId: string } }>("/api/problems/:problemId/progress", async (request) => repository.getProblemProgress(request.params.problemId));
app.get<{ Params: { problemId: string } }>("/api/problems/:problemId/progress/history", async (request) => repository.getProblemProgressHistory(request.params.problemId));
app.post<{ Body: unknown }>("/api/local/sessions", async (request) => {
  const body = z.object({ problemId: z.string().min(1), track: z.enum(["CODING", "EXPLANATION"]).default("CODING") }).parse(request.body);
  return repository.startPracticeSession(body.problemId, body.track as ReviewTrack);
});
app.post<{ Params: { sessionId: string } }>("/api/local/sessions/:sessionId/heartbeat", async (request) => repository.heartbeatPracticeSession(request.params.sessionId));
app.post<{ Params: { sessionId: string } }>("/api/local/sessions/:sessionId/finish", async (request) => repository.finishPracticeSession(request.params.sessionId));
app.get("/api/local/workspace/active", async () => workspace.getActiveWorkspace());
app.post("/api/local/workspace/active/clear", async () => workspace.clearActiveWorkspace());
app.post<{ Params: { problemId: string } }>("/api/local/problems/:problemId/scaffold", async (request) => workspace.createScaffold(request.params.problemId));
app.post<{ Params: { problemId: string } }>("/api/local/problems/:problemId/open-editor", async (request) => workspace.openInEditor(request.params.problemId));
app.post<{ Params: { problemId: string }; Body: unknown }>("/api/local/problems/:problemId/run-tests", async (request) => {
  const body = z.object({ sessionId: z.string().min(1).optional() }).parse(request.body ?? {});
  return workspace.runTests(request.params.problemId, body.sessionId ?? null);
});

const frontendRoot = findFrontendRoot();
if (frontendRoot) {
  await app.register(fastifyStatic, { root: frontendRoot, wildcard: true, index: false });
  app.get("/", async (_request, reply) => reply.sendFile("index.html"));
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/") || request.url === "/health") {
      const requestId = requestIdFor(request);
      return reply.code(404).send({
        code: "NOT_FOUND",
        message: "The requested JURO endpoint was not found.",
        hint: "Check the URL and restart JURO if the endpoint should exist.",
        requestId,
        details: ["The requested JURO endpoint was not found."],
      });
    }
    return reply.sendFile("index.html");
  });
}

async function submit(problemId: string, submittedLanguage: string, sourceCode: string) {
  const language = submittedLanguage.trim().toUpperCase();
  if (!isSupportedLanguage(language)) throw new Error("JURO supports Java, Python, JavaScript, and Go submissions only.");
  const problem = repository.getProblem(problemId);
  if (problem.type !== language) throw new Error(`This problem is configured for ${problem.type}; submit code in the same language.`);
  if (problem.testCases.length < 3) throw new Error(`Problem ${problem.id} must have at least 3 runnable test cases.`);
  const result = await workspace.judgeSubmission(problem, sourceCode.trim());
  const submission = repository.saveSubmission({ problemId, submittedLanguage: language, sourceCode: sourceCode.trim(), ...result });
  repository.recordReview(problemId, "CODING", result.status === "ACCEPTED");
  return submission;
}

function findFrontendRoot(): string | null {
  const candidates = [config.frontendDist, path.resolve(process.cwd(), "frontend/dist"), path.resolve(process.cwd(), "../frontend/dist")];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) ?? null;
}

const close = async () => {
  await app.close();
  database.close();
};
process.once("SIGINT", () => void close().then(() => process.exit(0)));
process.once("SIGTERM", () => void close().then(() => process.exit(0)));

await app.listen({ port: config.port, host: config.host });
console.log(`JURO web server listening at http://${config.host}:${config.port}`);
