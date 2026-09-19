import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JuroDatabase } from "./db.js";
import { ProblemRepository } from "./repository.js";
import { problemInputSchema } from "./problem-schema.js";
import { supportedLanguages } from "./runners.js";
import type { KnowledgeEvaluationResult, ProblemProgressStatus } from "./types.js";

const database = new JuroDatabase();
const repository = new ProblemRepository(database);

const server = new McpServer({ name: "juro-problem-mcp", version: "2.0.0" });

server.registerTool("list_supported_languages", {
  description: "List the programming languages currently supported by JURO's local runners.",
  inputSchema: {},
}, async () => ({ content: [{ type: "text", text: JSON.stringify(supportedLanguages) }] }));

server.registerTool("list_problems", {
  description: "List problems from the local JURO SQLite catalog.",
  inputSchema: { query: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) },
}, async ({ query, limit }) => {
  const problems = repository.listProblems().filter((problem) => !query || `${problem.title} ${problem.slug}`.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  return { content: [{ type: "text", text: JSON.stringify(problems) }] };
});

server.registerTool("get_problem", {
  description: "Get one complete JURO problem by id or slug.",
  inputSchema: { id: z.string().min(1).optional(), slug: z.string().min(1).optional() },
}, async ({ id, slug }) => {
  const problem = id ? repository.getProblem(id) : slug ? repository.getProblemBySlug(slug) : null;
  if (!problem) throw new Error("Provide a valid id or slug, and ensure the problem exists.");
  return { content: [{ type: "text", text: JSON.stringify(problem) }] };
});

server.registerTool("create_problem", {
  description: "Create a complete Java, Python, JavaScript, or Go problem in the local JURO catalog. Test cases are stored in SQLite; no problem-bank JSON file is required.",
  inputSchema: problemInputSchema.shape,
}, async (input) => {
  const problem = repository.createProblem(problemInputSchema.parse(input));
  return { content: [{ type: "text", text: JSON.stringify(problem) }] };
});

server.registerTool("update_problem", {
  description: "Replace a complete existing multi-language problem and its examples/test cases.",
  inputSchema: { id: z.string().min(1), problem: problemInputSchema },
}, async ({ id, problem }) => {
  const updated = repository.updateProblem(id, problemInputSchema.parse(problem));
  return { content: [{ type: "text", text: JSON.stringify(updated) }] };
});

server.registerTool("delete_problem", {
  description: "Delete an existing problem and dependent content. This is irreversible. IDs are JURO catalog IDs and are not required to be RFC UUIDs.",
  inputSchema: { id: z.string().min(1), confirmDelete: z.literal(true) },
}, async ({ id }) => {
  repository.deleteProblem(id);
  return { content: [{ type: "text", text: JSON.stringify({ deleted: true, id }) }] };
});

server.registerTool("set_current_problem", {
  description: "Set the problem the learner is currently solving. This context is shared with the JURO web app.",
  inputSchema: { problemId: z.string().min(1), lastAction: z.string().min(1).max(80).optional() },
}, async ({ problemId, lastAction }) => ({ content: [{ type: "text", text: JSON.stringify(repository.setCurrentProblem(problemId, lastAction ?? "MCP_SELECTED")) }] }));

server.registerTool("get_current_problem", {
  description: "Get the current problem context and a safe problem statement for coaching. Reference solutions and hidden tests are never returned by this tool.",
  inputSchema: {},
}, async () => {
  const current = repository.getCurrentProblem();
  if (!current) return { content: [{ type: "text", text: JSON.stringify({ current: null, progress: null, problem: null }) }] };
  return { content: [{ type: "text", text: JSON.stringify({ current, progress: repository.getProblemProgress(current.problemId), problem: repository.getKnowledgeProblemContext(current.problemId) }) }] };
});

server.registerTool("get_problem_progress", {
  description: "Inspect the current progress of a problem: unsolved, in progress, solved, or failed, including the latest test and review results.",
  inputSchema: { problemId: z.string().min(1).optional() },
}, async ({ problemId }) => {
  const progress = repository.getProblemProgress(problemId);
  if (!progress) throw new Error("No current problem is selected.");
  return { content: [{ type: "text", text: JSON.stringify(progress) }] };
});

server.registerTool("record_problem_status", {
  description: "Record a learner-visible status for the current problem after coaching or an external test run.",
  inputSchema: { problemId: z.string().min(1), status: z.enum(["UNSOLVED", "IN_PROGRESS", "SOLVED", "FAILED"]), lastAction: z.string().min(1).max(80) },
}, async ({ problemId, status, lastAction }) => ({ content: [{ type: "text", text: JSON.stringify(repository.recordProblemStatus(problemId, status as ProblemProgressStatus, lastAction)) }] }));

server.registerTool("start_knowledge_check", {
  description: "Start a spoken or written knowledge check for the current problem. Returns the statement, examples, rubric, and a session id, but never a reference solution or hidden tests.",
  inputSchema: { problemId: z.string().min(1).optional(), sessionId: z.string().min(1).optional() },
}, async ({ problemId, sessionId }) => {
  const selected = problemId ?? repository.getCurrentProblem()?.problemId;
  if (!selected) throw new Error("Select a current problem before starting a knowledge check.");
  const existing = sessionId ? repository.getKnowledgeCheck(sessionId) : null;
  if (sessionId && !existing) throw new Error("The requested knowledge-check session was not found.");
  if (existing && existing.problemId !== selected) throw new Error("The knowledge-check session belongs to a different problem.");
  const session = existing ?? repository.startKnowledgeCheck(selected);
  return { content: [{ type: "text", text: JSON.stringify({ session, problem: repository.getKnowledgeProblemContext(selected), instructions: "Ask the learner to explain the algorithm, invariants, edge cases, and complexity. Then submit the structured result with submit_knowledge_check." }) }] };
});

server.registerTool("submit_knowledge_check", {
  description: "Save Claude's structured assessment of a learner's spoken or written explanation and update problem progress.",
  inputSchema: {
    sessionId: z.string().min(1),
    problemId: z.string().min(1),
    transcript: z.string().max(100_000).optional(),
    status: z.enum(["PASSED", "NEEDS_REVIEW", "FAILED"]),
    score: z.number().min(0).max(100),
    summary: z.string().min(1),
    missingConcepts: z.array(z.string()).default([]),
    strengths: z.array(z.string()).default([]),
    suggestedReview: z.string().default(""),
    model: z.string().default("Claude via JURO MCP"),
  },
}, async ({ sessionId, problemId, transcript, status, score, summary, missingConcepts, strengths, suggestedReview, model }) => {
  const evaluation: KnowledgeEvaluationResult = {
    status,
    score,
    summary,
    missingConcepts,
    strengths,
    suggestedReview,
    model,
    createdAt: new Date().toISOString(),
  };
  const session = repository.submitKnowledgeCheck({ id: sessionId, problemId, transcript, evaluation });
  return { content: [{ type: "text", text: JSON.stringify(session) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.once("SIGINT", () => { database.close(); process.exit(0); });
