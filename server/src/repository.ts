import { randomUUID } from "node:crypto";
import type { JuroDatabase } from "./db.js";
import type { ActivitySummary, CurrentProblemContext, KnowledgeCheckHistoryEntry, KnowledgeCheckSession, KnowledgeEvaluationResult, KnowledgeProblemContext, PracticeSession, PracticeSessionStatus, Problem, ProblemExample, ProblemProgress, ProblemProgressHistory, ProblemProgressStatus, ProblemProgressSummary, ProblemSummary, ProblemTestCase, ReviewHistoryEntry, ReviewResult, ReviewState, ReviewStatus, ReviewTrack, Row, Submission, SubmissionCaseResult, TestAttemptHistory, TodayQueue } from "./types.js";

const reviewTracks: ReviewTrack[] = ["CODING", "EXPLANATION"];
const nowIso = () => new Date().toISOString();

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  return value == null ? null : String(value);
}

function problemExample(row: Row): ProblemExample {
  return {
    id: text(row.id),
    label: text(row.label),
    sortOrder: Number(row.sort_order),
    inputData: text(row.input_data),
    expectedOutput: text(row.expected_output),
    explanation: nullableText(row.explanation),
    createdAt: text(row.created_at),
  };
}

function problemTestCase(row: Row): ProblemTestCase {
  return {
    ...problemExample(row),
    hidden: Number(row.hidden) === 1,
  };
}

function reviewState(row: Row): ReviewState {
  return {
    track: text(row.track) as ReviewTrack,
    status: text(row.status) as ReviewStatus,
    dueAt: text(row.due_at),
    lastReviewedAt: nullableText(row.last_reviewed_at),
    intervalDays: Number(row.interval_days),
    easeFactor: Number(row.ease_factor),
    repetitions: Number(row.repetitions),
    lapses: Number(row.lapses),
    lastResult: row.last_result == null ? null : text(row.last_result) as ReviewResult,
    priorityScore: Number(row.priority_score),
  };
}

function practiceSession(row: Row): PracticeSession {
  return {
    id: text(row.id),
    problemId: text(row.problem_id),
    track: text(row.track) as ReviewTrack,
    status: text(row.status) as PracticeSessionStatus,
    startedAt: text(row.started_at),
    lastHeartbeatAt: text(row.last_heartbeat_at),
    endedAt: nullableText(row.ended_at),
    activeTimeMillis: Number(row.active_time_millis ?? 0),
    updatedAt: text(row.updated_at),
  };
}

function testAttemptHistory(row: Row): TestAttemptHistory {
  return {
    id: text(row.id),
    problemId: text(row.problem_id),
    sessionId: nullableText(row.session_id),
    submittedLanguage: text(row.submitted_language),
    status: text(row.status),
    passedCases: Number(row.passed_cases ?? 0),
    totalCases: Number(row.total_cases ?? 0),
    runtimeMillis: Number(row.runtime_millis ?? 0),
    createdAt: text(row.created_at),
  };
}

function reviewHistoryEntry(row: Row): ReviewHistoryEntry {
  return {
    id: text(row.id),
    problemId: text(row.problem_id),
    sessionId: nullableText(row.session_id),
    track: text(row.track) as ReviewTrack,
    passed: Number(row.passed) === 1,
    previousStatus: row.previous_status == null ? null : text(row.previous_status) as ReviewStatus,
    previousDueAt: nullableText(row.previous_due_at),
    newStatus: text(row.new_status) as ReviewStatus,
    newDueAt: text(row.new_due_at),
    intervalDays: Number(row.interval_days),
    createdAt: text(row.created_at),
  };
}

function knowledgeHistoryEntry(row: Row): KnowledgeCheckHistoryEntry {
  return {
    id: text(row.id),
    problemId: text(row.problem_id),
    sessionId: nullableText(row.session_id),
    knowledgeSessionId: text(row.knowledge_session_id),
    status: text(row.status) as KnowledgeCheckHistoryEntry["status"],
    score: Number(row.score ?? 0),
    summary: text(row.summary),
    createdAt: text(row.created_at),
  };
}

export class ProblemRepository {
  constructor(private readonly database: JuroDatabase) {}

  listProblems(): ProblemSummary[] {
    const rows = this.database.db.prepare("SELECT * FROM problems WHERE type IN ('JAVA', 'PYTHON', 'JAVASCRIPT', 'GO') ORDER BY created_at DESC").all() as Row[];
    return rows.map((row) => {
      const id = text(row.id);
      this.ensureReviewStates(id);
      const examples = this.database.db.prepare("SELECT COUNT(*) AS count FROM problem_examples WHERE problem_id = ?").get(id) as { count: number };
      const testCases = this.database.db.prepare("SELECT COUNT(*) AS count FROM problem_test_cases WHERE problem_id = ?").get(id) as { count: number };
      const states = this.reviewStates(id);
      return {
        id,
        slug: text(row.slug),
        title: text(row.title),
        summary: text(row.summary),
        type: text(row.type) as Problem["type"],
        difficulty: text(row.difficulty) as Problem["difficulty"],
        solutionVideoUrl: nullableText(row.solution_video_url),
        exampleCount: Number(examples.count),
        testCaseCount: Number(testCases.count),
        codingReview: states.CODING,
        explanationReview: states.EXPLANATION,
        createdAt: text(row.created_at),
        updatedAt: text(row.updated_at),
      };
    });
  }

  getProblem(id: string): Problem {
    const row = this.database.db.prepare("SELECT * FROM problems WHERE id = ?").get(id) as Row | undefined;
    if (!row) throw new Error(`Problem ${id} was not found.`);
    return this.toProblem(row);
  }

  getProblemBySlug(slug: string): Problem | null {
    const row = this.database.db.prepare("SELECT * FROM problems WHERE slug = ?").get(slug) as Row | undefined;
    return row ? this.toProblem(row) : null;
  }

  getKnowledgeProblemContext(problemId: string): KnowledgeProblemContext {
    const problem = this.getProblem(problemId);
    return {
      id: problem.id,
      slug: problem.slug,
      title: problem.title,
      summary: problem.summary,
      descriptionMarkdown: problem.descriptionMarkdown,
      constraintsMarkdown: problem.constraintsMarkdown,
      type: problem.type,
      difficulty: problem.difficulty,
      starterCode: problem.starterCode,
      knowledgeRubric: problem.knowledgeRubric,
      examples: problem.examples,
    };
  }

  getCurrentProblem(): CurrentProblemContext | null {
    const row = this.database.db.prepare(`SELECT context.*, problems.title, problems.slug
      FROM current_problem_context context
      JOIN problems ON problems.id = context.problem_id
      WHERE context.id = 1`).get() as Row | undefined;
    return row ? this.toCurrentProblemContext(row) : null;
  }

  setCurrentProblem(problemId: string, lastAction = "SELECTED"): CurrentProblemContext {
    const problem = this.getProblem(problemId);
    const now = nowIso();
    this.database.db.prepare(`INSERT INTO current_problem_context
      (id, problem_id, status, last_action, updated_at)
      VALUES (1, ?, 'IN_PROGRESS', ?, ?)
      ON CONFLICT(id) DO UPDATE SET problem_id = excluded.problem_id,
        status = 'IN_PROGRESS',
        last_action = excluded.last_action, last_test_status = NULL, last_test_at = NULL,
        last_knowledge_status = NULL, last_knowledge_at = NULL, updated_at = excluded.updated_at`).run(problem.id, lastAction, now);
    this.recordActivity(problem.id, "PROBLEM_SELECTED", now);
    return this.getCurrentProblem() as CurrentProblemContext;
  }

  recordProblemStatus(problemId: string, status: ProblemProgressStatus, lastAction: string): CurrentProblemContext {
    const current = this.getCurrentProblem();
    if (!current || current.problemId !== problemId) this.setCurrentProblem(problemId, lastAction);
    const now = nowIso();
    this.database.db.prepare(`UPDATE current_problem_context
      SET status = ?, last_action = ?, updated_at = ? WHERE id = 1 AND problem_id = ?`).run(status, lastAction, now, problemId);
    this.recordActivity(problemId, `STATUS_${status}`, now);
    return this.getCurrentProblem() as CurrentProblemContext;
  }

  recordProblemTestResult(problemId: string, testStatus: string): CurrentProblemContext {
    const normalized = testStatus.toUpperCase();
    // Running tests is evidence for the self-grade; it is not the grade itself.
    // Keep the problem in progress until recordReview() receives the learner's decision.
    const progress: ProblemProgressStatus = "IN_PROGRESS";
    const current = this.getCurrentProblem();
    if (!current || current.problemId !== problemId) this.setCurrentProblem(problemId, "TESTED");
    const now = nowIso();
    this.database.db.prepare(`UPDATE current_problem_context SET status = ?, last_action = 'TESTED',
      last_test_status = ?, last_test_at = ?, updated_at = ? WHERE id = 1 AND problem_id = ?`)
      .run(progress, normalized, now, now, problemId);
    this.recordActivity(problemId, `TEST_${normalized}`, now);
    return this.getCurrentProblem() as CurrentProblemContext;
  }

  recordKnowledgeStatus(problemId: string, knowledgeStatus: string): CurrentProblemContext {
    const current = this.getCurrentProblem();
    if (!current || current.problemId !== problemId) this.setCurrentProblem(problemId, "KNOWLEDGE_CHECK");
    const normalized = knowledgeStatus.toUpperCase();
    const now = nowIso();
    const nextStatus: ProblemProgressStatus = normalized === "PASSED" ? "SOLVED" : normalized === "FAILED" ? "FAILED" : "IN_PROGRESS";
    this.database.db.prepare(`UPDATE current_problem_context SET status = ?, last_action = 'KNOWLEDGE_CHECK',
      last_knowledge_status = ?, last_knowledge_at = ?, updated_at = ? WHERE id = 1 AND problem_id = ?`)
      .run(nextStatus, normalized, now, now, problemId);
    this.recordActivity(problemId, `KNOWLEDGE_${normalized}`, now);
    return this.getCurrentProblem() as CurrentProblemContext;
  }

  getProblemProgress(problemId?: string): ProblemProgress | null {
    const context = this.getCurrentProblem();
    const id = problemId ?? context?.problemId;
    if (!id) return null;
    const problem = this.getProblem(id);
    const states = this.reviewStates(id);
    const latestRow = this.database.db.prepare(`SELECT id, status, submitted_language, result_summary, created_at
      FROM submissions WHERE problem_id = ? ORDER BY created_at DESC LIMIT 1`).get(id) as Row | undefined;
    const latestSubmission = latestRow ? {
      id: text(latestRow.id),
      status: text(latestRow.status) as Submission["status"],
      submittedLanguage: text(latestRow.submitted_language),
      resultSummary: text(latestRow.result_summary),
      createdAt: text(latestRow.created_at),
    } : null;
    const matchingContext = context?.problemId === id ? context : null;
    const derivedStatus = matchingContext?.status
      ?? (latestSubmission?.status === "ACCEPTED" ? "SOLVED" : latestSubmission ? "FAILED" : states.CODING.status === "NEW" ? "UNSOLVED" : "IN_PROGRESS");
    return {
      problemId: problem.id,
      title: problem.title,
      slug: problem.slug,
      status: derivedStatus,
      lastAction: matchingContext?.lastAction ?? null,
      lastTestStatus: matchingContext?.lastTestStatus ?? null,
      lastTestAt: matchingContext?.lastTestAt ?? null,
      lastKnowledgeStatus: matchingContext?.lastKnowledgeStatus ?? null,
      lastKnowledgeAt: matchingContext?.lastKnowledgeAt ?? null,
      codingReview: states.CODING,
      explanationReview: states.EXPLANATION,
      latestSubmission,
      updatedAt: matchingContext?.updatedAt ?? null,
    };
  }

  startPracticeSession(problemId: string, track: ReviewTrack = "CODING"): PracticeSession {
    const problem = this.getProblem(problemId);
    const now = nowIso();
    const id = randomUUID();
    this.database.db.prepare(`INSERT INTO practice_sessions
      (id, problem_id, track, status, started_at, last_heartbeat_at, active_time_millis, created_at, updated_at)
      VALUES (?, ?, ?, 'ACTIVE', ?, ?, 0, ?, ?)`)
      .run(id, problem.id, track, now, now, now, now);
    this.recordActivity(problem.id, "SESSION_STARTED", now);
    return practiceSession(this.database.db.prepare("SELECT * FROM practice_sessions WHERE id = ?").get(id) as Row);
  }

  heartbeatPracticeSession(sessionId: string): PracticeSession {
    const row = this.database.db.prepare("SELECT * FROM practice_sessions WHERE id = ?").get(sessionId) as Row | undefined;
    if (!row) throw new Error(`Practice session ${sessionId} was not found.`);
    const current = practiceSession(row);
    if (current.status !== "ACTIVE") return current;
    const now = new Date();
    const lastHeartbeat = new Date(current.lastHeartbeatAt);
    const elapsed = Number.isNaN(lastHeartbeat.getTime()) ? 0 : Math.min(120_000, Math.max(0, now.getTime() - lastHeartbeat.getTime()));
    const nowValue = now.toISOString();
    this.database.db.prepare(`UPDATE practice_sessions
      SET active_time_millis = active_time_millis + ?, last_heartbeat_at = ?, updated_at = ?
      WHERE id = ? AND status = 'ACTIVE'`).run(elapsed, nowValue, nowValue, sessionId);
    return practiceSession(this.database.db.prepare("SELECT * FROM practice_sessions WHERE id = ?").get(sessionId) as Row);
  }

  finishPracticeSession(sessionId: string): PracticeSession {
    const current = this.heartbeatPracticeSession(sessionId);
    if (current.status !== "ACTIVE") return current;
    const now = nowIso();
    this.database.db.prepare(`UPDATE practice_sessions
      SET status = 'COMPLETED', ended_at = ?, updated_at = ? WHERE id = ? AND status = 'ACTIVE'`)
      .run(now, now, sessionId);
    this.recordActivity(current.problemId, "SESSION_FINISHED", now);
    return practiceSession(this.database.db.prepare("SELECT * FROM practice_sessions WHERE id = ?").get(sessionId) as Row);
  }

  recordTestAttempt(input: {
    problemId: string;
    sessionId?: string | null;
    submittedLanguage: string;
    status: string;
    passedCases: number;
    totalCases: number;
    runtimeMillis: number;
  }): TestAttemptHistory {
    this.getProblem(input.problemId);
    if (input.sessionId) {
      const session = this.database.db.prepare("SELECT problem_id FROM practice_sessions WHERE id = ?").get(input.sessionId) as { problem_id: string } | undefined;
      if (!session || session.problem_id !== input.problemId) throw new Error("The practice session does not belong to this problem.");
    }
    const id = randomUUID();
    const createdAt = nowIso();
    this.database.db.prepare(`INSERT INTO test_attempts
      (id, problem_id, session_id, submitted_language, status, passed_cases, total_cases, runtime_millis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.problemId, input.sessionId ?? null, input.submittedLanguage, input.status, Math.max(0, input.passedCases), Math.max(0, input.totalCases), Math.max(0, input.runtimeMillis), createdAt);
    this.recordActivity(input.problemId, "TEST_ATTEMPT", createdAt);
    return testAttemptHistory(this.database.db.prepare("SELECT * FROM test_attempts WHERE id = ?").get(id) as Row);
  }

  recordKnowledgeCheckHistory(input: {
    problemId: string;
    knowledgeSessionId: string;
    sessionId?: string | null;
    evaluation: KnowledgeEvaluationResult;
  }): KnowledgeCheckHistoryEntry {
    const id = randomUUID();
    const createdAt = input.evaluation.createdAt || nowIso();
    this.database.db.prepare(`INSERT OR REPLACE INTO knowledge_check_history
      (id, problem_id, session_id, knowledge_session_id, status, score, summary, evaluation_json, created_at)
      VALUES (COALESCE((SELECT id FROM knowledge_check_history WHERE knowledge_session_id = ?), ?), ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(input.knowledgeSessionId, id, input.problemId, input.sessionId ?? null, input.knowledgeSessionId, input.evaluation.status, input.evaluation.score, input.evaluation.summary, JSON.stringify(input.evaluation), createdAt);
    return knowledgeHistoryEntry(this.database.db.prepare("SELECT * FROM knowledge_check_history WHERE knowledge_session_id = ?").get(input.knowledgeSessionId) as Row);
  }

  getProblemProgressHistory(problemId: string): ProblemProgressHistory {
    const problem = this.getProblem(problemId);
    const activeSessions = this.database.db.prepare("SELECT id FROM practice_sessions WHERE problem_id = ? AND status = 'ACTIVE'").all(problem.id) as Array<{ id: string }>;
    activeSessions.forEach((session) => this.heartbeatPracticeSession(String(session.id)));
    const sessions = (this.database.db.prepare("SELECT * FROM practice_sessions WHERE problem_id = ? ORDER BY started_at DESC LIMIT 50").all(problem.id) as Row[]).map(practiceSession);
    const testAttempts = (this.database.db.prepare("SELECT * FROM test_attempts WHERE problem_id = ? ORDER BY created_at DESC LIMIT 100").all(problem.id) as Row[]).map(testAttemptHistory);
    const reviews = (this.database.db.prepare("SELECT * FROM review_history WHERE problem_id = ? ORDER BY created_at DESC LIMIT 100").all(problem.id) as Row[]).map(reviewHistoryEntry);
    const knowledgeChecks = (this.database.db.prepare("SELECT * FROM knowledge_check_history WHERE problem_id = ? ORDER BY created_at DESC LIMIT 100").all(problem.id) as Row[]).map(knowledgeHistoryEntry);
    const scores = knowledgeChecks.map((check) => check.score).filter((score) => Number.isFinite(score));
    const activityDates = [
      ...sessions.map((session) => session.updatedAt),
      ...testAttempts.map((attempt) => attempt.createdAt),
      ...reviews.map((review) => review.createdAt),
      ...knowledgeChecks.map((check) => check.createdAt),
    ].filter(Boolean);
    const summary: ProblemProgressSummary = {
      attempts: testAttempts.length,
      passedAttempts: testAttempts.filter((attempt) => attempt.status === "PASSED").length,
      failedAttempts: testAttempts.filter((attempt) => attempt.status !== "PASSED").length,
      passedTestCases: testAttempts.reduce((total, attempt) => total + attempt.passedCases, 0),
      totalTestCases: testAttempts.reduce((total, attempt) => total + attempt.totalCases, 0),
      totalRuntimeMillis: testAttempts.reduce((total, attempt) => total + attempt.runtimeMillis, 0),
      timeSpentMillis: sessions.reduce((total, session) => total + session.activeTimeMillis, 0),
      reviewGrades: reviews.length,
      passedReviews: reviews.filter((review) => review.passed).length,
      failedReviews: reviews.filter((review) => !review.passed).length,
      knowledgeChecks: knowledgeChecks.length,
      averageKnowledgeScore: scores.length > 0 ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10 : null,
      lastActivityAt: activityDates.sort().at(-1) ?? null,
    };
    return { problemId: problem.id, summary, sessions, testAttempts, reviews, knowledgeChecks };
  }

  getActivitySummary(days = 365): ActivitySummary {
    const periodDays = Math.max(30, Math.min(730, Math.floor(days)));
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - periodDays + 1);
    const endExclusive = new Date(end);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const rows = this.database.db.prepare(`SELECT substr(occurred_at, 1, 10) AS activity_date, COUNT(*) AS count
      FROM activity_events
      WHERE occurred_at >= ? AND occurred_at < ?
      GROUP BY activity_date`).all(start.toISOString(), endExclusive.toISOString()) as Row[];
    const counts = new Map(rows.map((row) => [text(row.activity_date), Number(row.count)]));
    const activityDays = [] as Array<{ date: string; count: number }>;
    let totalActivity = 0;
    let activeDays = 0;
    for (let index = 0; index < periodDays; index += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const count = counts.get(dateKey) ?? 0;
      activityDays.push({ date: dateKey, count });
      totalActivity += count;
      if (count > 0) activeDays += 1;
    }
    return {
      startDate: activityDays[0]?.date ?? start.toISOString().slice(0, 10),
      endDate: activityDays.at(-1)?.date ?? end.toISOString().slice(0, 10),
      totalActivity,
      activeDays,
      days: activityDays,
    };
  }

  getTodayQueue(limit = 8): TodayQueue {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);
    const today = now.toISOString().slice(0, 10);
    const rank: Record<"OVERDUE" | "DUE_TODAY" | "NEW", number> = { OVERDUE: 0, DUE_TODAY: 1, NEW: 2 };
    const candidates: TodayQueue["items"] = [];

    for (const problem of this.listProblems()) {
      for (const [track, review] of [["CODING", problem.codingReview], ["EXPLANATION", problem.explanationReview]] as const) {
        const dueAt = new Date(review.dueAt);
        let reason: TodayQueue["items"][number]["reason"] | null = null;
        if (review.status === "NEW") {
          reason = "NEW";
        } else if (!Number.isNaN(dueAt.getTime()) && dueAt <= now) {
          reason = "OVERDUE";
        } else if (!Number.isNaN(dueAt.getTime()) && dueAt <= endOfToday) {
          reason = "DUE_TODAY";
        }
        if (!reason) continue;

        candidates.push({
          problemId: problem.id,
          title: problem.title,
          slug: problem.slug,
          summary: problem.summary,
          type: problem.type,
          difficulty: problem.difficulty,
          track,
          reason,
          dueAt: review.dueAt,
          priorityScore: review.priorityScore,
          estimatedMinutes: estimatedReviewMinutes(track, problem.difficulty),
        });
      }
    }

    candidates.sort((left, right) => {
      const reasonOrder = rank[left.reason] - rank[right.reason];
      if (reasonOrder !== 0) return reasonOrder;
      const priorityOrder = right.priorityScore - left.priorityScore;
      if (priorityOrder !== 0) return priorityOrder;
      const dueOrder = new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
      if (dueOrder !== 0) return dueOrder;
      if (left.track !== right.track) return left.track === "CODING" ? -1 : 1;
      return left.title.localeCompare(right.title);
    });

    const maxItems = Math.max(1, Math.min(20, Math.floor(limit)));
    const items = candidates.slice(0, maxItems);
    const completedRow = this.database.db.prepare(`SELECT COUNT(*) AS count FROM activity_events
      WHERE substr(occurred_at, 1, 10) = ? AND instr(kind, '_REVIEW_') > 0`).get(today) as { count: number };
    return {
      date: today,
      completedToday: Number(completedRow.count),
      totalCandidates: candidates.length,
      estimatedMinutes: items.reduce((total, item) => total + item.estimatedMinutes, 0),
      items,
    };
  }

  startKnowledgeCheck(problemId: string, transcript = ""): KnowledgeCheckSession {
    this.getProblem(problemId);
    const id = randomUUID();
    const createdAt = nowIso();
    this.database.db.prepare(`INSERT INTO knowledge_check_sessions
      (id, problem_id, status, transcript, created_at) VALUES (?, ?, 'STARTED', ?, ?)`)
      .run(id, problemId, transcript.slice(0, 100_000), createdAt);
    this.recordActivity(problemId, "KNOWLEDGE_CHECK_STARTED", createdAt);
    this.setCurrentProblem(problemId, "KNOWLEDGE_CHECK_STARTED");
    return this.getKnowledgeCheck(id) as KnowledgeCheckSession;
  }

  getKnowledgeCheck(id: string): KnowledgeCheckSession | null {
    const row = this.database.db.prepare("SELECT * FROM knowledge_check_sessions WHERE id = ?").get(id) as Row | undefined;
    return row ? this.toKnowledgeCheck(row) : null;
  }

  submitKnowledgeCheck(input: { id: string; problemId: string; transcript?: string; evaluation: KnowledgeEvaluationResult }): KnowledgeCheckSession {
    const current = this.getKnowledgeCheck(input.id);
    if (!current || current.problemId !== input.problemId) throw new Error("Knowledge check session was not found for this problem.");
    const completedAt = nowIso();
    this.database.db.prepare(`UPDATE knowledge_check_sessions SET status = 'SUBMITTED', transcript = ?,
      evaluation_json = ?, completed_at = ? WHERE id = ?`)
      .run((input.transcript ?? current.transcript).slice(0, 100_000), JSON.stringify(input.evaluation), completedAt, input.id);
    this.recordActivity(input.problemId, "KNOWLEDGE_CHECK_SUBMITTED", completedAt);
    this.recordKnowledgeStatus(input.problemId, input.evaluation.status);
    this.recordKnowledgeCheckHistory({
      problemId: input.problemId,
      knowledgeSessionId: input.id,
      evaluation: input.evaluation,
    });
    if (input.evaluation.status === "PASSED" || input.evaluation.status === "FAILED") {
      this.recordReview(input.problemId, "EXPLANATION", input.evaluation.status === "PASSED");
    }
    return this.getKnowledgeCheck(input.id) as KnowledgeCheckSession;
  }

  createProblem(input: ProblemInput): Problem {
    const id = randomUUID();
    const now = nowIso();
    this.database.transaction(() => {
      this.database.db.prepare(`INSERT INTO problems
        (id, slug, title, summary, description_markdown, constraints_markdown, type, difficulty,
         starter_code, reference_solution, evaluation_notes, solution_video_url, knowledge_rubric, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.slug, input.title, input.summary, input.descriptionMarkdown, input.constraintsMarkdown ?? null,
          input.type, input.difficulty, input.starterCode ?? null, input.referenceSolution ?? null,
          input.evaluationNotes ?? null, input.solutionVideoUrl ?? null, input.knowledgeRubric, now, now);
      this.replaceChildren(id, input);
      this.ensureReviewStates(id);
    });
    this.recordActivity(id, "PROBLEM_CREATED", now);
    return this.getProblem(id);
  }

  updateProblem(id: string, input: ProblemInput): Problem {
    this.getProblem(id);
    this.database.transaction(() => {
      this.database.db.prepare(`UPDATE problems SET slug = ?, title = ?, summary = ?, description_markdown = ?,
        constraints_markdown = ?, type = ?, difficulty = ?, starter_code = ?, reference_solution = ?,
        evaluation_notes = ?, solution_video_url = ?, knowledge_rubric = ?, updated_at = ? WHERE id = ?`)
        .run(input.slug, input.title, input.summary, input.descriptionMarkdown, input.constraintsMarkdown ?? null,
          input.type, input.difficulty, input.starterCode ?? null, input.referenceSolution ?? null,
          input.evaluationNotes ?? null, input.solutionVideoUrl ?? null, input.knowledgeRubric, nowIso(), id);
      this.replaceChildren(id, input);
    });
    return this.getProblem(id);
  }

  deleteProblem(id: string): void {
    const result = this.database.db.prepare("DELETE FROM problems WHERE id = ?").run(id);
    if (Number(result.changes) === 0) throw new Error(`Problem ${id} was not found.`);
  }

  listSubmissions(problemId: string): Submission[] {
    this.getProblem(problemId);
    const rows = this.database.db.prepare("SELECT * FROM submissions WHERE problem_id = ? ORDER BY created_at DESC").all(problemId) as Row[];
    return rows.map((row) => this.toSubmission(row));
  }

  saveSubmission(input: {
    problemId: string;
    submittedLanguage: string;
    sourceCode: string;
    status: string;
    resultSummary: string;
    totalRuntimeMillis: number | null;
    caseResults: SubmissionCaseResult[];
  }): Submission {
    const id = randomUUID();
    const createdAt = nowIso();
    this.database.db.prepare(`INSERT INTO submissions
      (id, problem_id, submitted_language, source_code, status, result_summary, total_runtime_millis, result_details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.problemId, input.submittedLanguage, input.sourceCode, input.status, input.resultSummary,
        input.totalRuntimeMillis, JSON.stringify(input.caseResults), createdAt);
    this.recordActivity(input.problemId, "SUBMISSION", createdAt);
    this.recordTestAttempt({
      problemId: input.problemId,
      submittedLanguage: input.submittedLanguage,
      status: input.status === "ACCEPTED" ? "PASSED" : "FAILED",
      passedCases: input.caseResults.filter((caseResult) => caseResult.passed).length,
      totalCases: input.caseResults.length,
      runtimeMillis: input.totalRuntimeMillis ?? 0,
    });
    return this.toSubmission(this.database.db.prepare("SELECT * FROM submissions WHERE id = ?").get(id) as Row);
  }

  ensureReviewStates(problemId: string): void {
    const now = nowIso();
    for (const track of reviewTracks) {
      const existing = this.database.db.prepare("SELECT id FROM problem_review_states WHERE problem_id = ? AND track = ?").get(problemId, track);
      if (!existing) {
        this.database.db.prepare(`INSERT INTO problem_review_states
          (id, problem_id, track, status, due_at, interval_days, ease_factor, repetitions, lapses, priority_score, created_at, updated_at)
          VALUES (?, ?, ?, 'NEW', ?, 0, 2.5, 0, 0, ?, ?, ?)`)
          .run(randomUUID(), problemId, track, now, track === "EXPLANATION" ? 2 : 1.5, now, now);
      }
    }
  }

  reviewStates(problemId: string): Record<ReviewTrack, ReviewState> {
    this.ensureReviewStates(problemId);
    const now = new Date();
    const rows = this.database.db.prepare("SELECT * FROM problem_review_states WHERE problem_id = ?").all(problemId) as Row[];
    const result = {} as Record<ReviewTrack, ReviewState>;
    for (const row of rows) {
      const state = reviewState(row);
      const due = new Date(state.dueAt);
      const overdueHours = (now.getTime() - due.getTime()) / 3_600_000;
      const dueWeight = overdueHours >= 0 ? 10 + overdueHours / 24 : 1 / (1 + Math.abs(overdueHours) / 24);
      const trackWeight = state.track === "EXPLANATION" ? 1.35 : 1;
      const priorityScore = Math.round(dueWeight * trackWeight * (1 + state.lapses * 0.15) * 100) / 100;
      const status = due <= now && state.status !== "NEW" ? "DUE" : state.status;
      this.database.db.prepare("UPDATE problem_review_states SET status = ?, priority_score = ?, updated_at = ? WHERE id = ?")
        .run(status, priorityScore, now.toISOString(), text(row.id));
      result[state.track] = { ...state, status: status as ReviewStatus, priorityScore };
    }
    return result;
  }

  recordReview(problemId: string, track: ReviewTrack, passed: boolean, sessionId: string | null = null): ReviewState {
    this.getProblem(problemId);
    this.ensureReviewStates(problemId);
    if (sessionId) {
      const session = this.database.db.prepare("SELECT problem_id FROM practice_sessions WHERE id = ?").get(sessionId) as { problem_id: string } | undefined;
      if (!session || session.problem_id !== problemId) throw new Error("The practice session does not belong to this problem.");
    }
    const row = this.database.db.prepare("SELECT * FROM problem_review_states WHERE problem_id = ? AND track = ?").get(problemId, track) as Row;
    const current = reviewState(row);
    const grade = passed ? 4 : 1;
    const now = new Date();
    let intervalDays: number;
    let repetitions: number;
    let lapses = current.lapses;
    let easeFactor = current.easeFactor;
    let status: ReviewStatus;
    let lastResult: ReviewResult;
    if (!passed) {
      lapses += 1;
      repetitions = 0;
      intervalDays = track === "EXPLANATION" ? 1 : 2;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      status = "LEARNING";
      lastResult = "FAILED";
    } else {
      repetitions = current.repetitions + 1;
      intervalDays = passedIntervalDays(track, repetitions, current.intervalDays, easeFactor, grade);
      easeFactor = nextEase(easeFactor, grade);
      status = intervalDays >= (track === "EXPLANATION" ? 21 : 45) ? "MASTERED" : "REVIEW";
      lastResult = "PASSED";
    }
    const dueAt = new Date(now.getTime() + Math.max(1, intervalDays) * 86_400_000).toISOString();
    this.database.db.prepare(`UPDATE problem_review_states SET status = ?, due_at = ?, last_reviewed_at = ?, interval_days = ?, ease_factor = ?, repetitions = ?, lapses = ?, last_result = ?, updated_at = ? WHERE id = ?`)
      .run(status, dueAt, now.toISOString(), intervalDays, easeFactor, repetitions, lapses, lastResult, now.toISOString(), text(row.id));
    this.recordActivity(problemId, `${track}_REVIEW_${lastResult}`, now.toISOString());
    if (track === "CODING") this.recordProblemStatus(problemId, passed ? "SOLVED" : "FAILED", passed ? "CODING_REVIEW_PASSED" : "CODING_REVIEW_FAILED");
    const nextReview = this.reviewStates(problemId)[track];
    this.database.db.prepare(`INSERT INTO review_history
      (id, problem_id, session_id, track, passed, previous_status, previous_due_at, new_status, new_due_at, interval_days, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), problemId, sessionId, track, passed ? 1 : 0, current.status, current.dueAt, nextReview.status, nextReview.dueAt, nextReview.intervalDays, now.toISOString());
    return nextReview;
  }

  private toCurrentProblemContext(row: Row): CurrentProblemContext {
    return {
      problemId: text(row.problem_id),
      title: text(row.title),
      slug: text(row.slug),
      status: text(row.status) as ProblemProgressStatus,
      lastAction: text(row.last_action),
      lastTestStatus: nullableText(row.last_test_status),
      lastTestAt: nullableText(row.last_test_at),
      lastKnowledgeStatus: nullableText(row.last_knowledge_status),
      lastKnowledgeAt: nullableText(row.last_knowledge_at),
      updatedAt: text(row.updated_at),
    };
  }

  private recordActivity(problemId: string | null, kind: string, occurredAt = nowIso()): void {
    this.database.db.prepare("INSERT INTO activity_events (id, problem_id, kind, occurred_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), problemId, kind, occurredAt);
  }

  private toKnowledgeCheck(row: Row): KnowledgeCheckSession {
    let evaluation: KnowledgeEvaluationResult | null = null;
    if (row.evaluation_json) {
      try { evaluation = JSON.parse(String(row.evaluation_json)) as KnowledgeEvaluationResult; } catch { evaluation = null; }
    }
    return {
      id: text(row.id),
      problemId: text(row.problem_id),
      status: text(row.status) as KnowledgeCheckSession["status"],
      transcript: text(row.transcript),
      evaluation,
      createdAt: text(row.created_at),
      completedAt: nullableText(row.completed_at),
    };
  }

  private toProblem(row: Row): Problem {
    const id = text(row.id);
    const examples = this.database.db.prepare("SELECT * FROM problem_examples WHERE problem_id = ? ORDER BY sort_order, created_at").all(id) as Row[];
    const testCases = this.database.db.prepare("SELECT * FROM problem_test_cases WHERE problem_id = ? ORDER BY sort_order, created_at").all(id) as Row[];
    return {
      id,
      slug: text(row.slug),
      title: text(row.title),
      summary: text(row.summary),
      descriptionMarkdown: text(row.description_markdown),
      constraintsMarkdown: nullableText(row.constraints_markdown),
      type: text(row.type) as Problem["type"],
      difficulty: text(row.difficulty) as Problem["difficulty"],
      starterCode: nullableText(row.starter_code),
      referenceSolution: nullableText(row.reference_solution),
      evaluationNotes: nullableText(row.evaluation_notes),
      solutionVideoUrl: nullableText(row.solution_video_url),
      knowledgeRubric: text(row.knowledge_rubric),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      examples: examples.map(problemExample),
      testCases: testCases.map(problemTestCase),
    };
  }

  private replaceChildren(problemId: string, input: ProblemInput): void {
    this.database.db.prepare("DELETE FROM problem_examples WHERE problem_id = ?").run(problemId);
    this.database.db.prepare("DELETE FROM problem_test_cases WHERE problem_id = ?").run(problemId);
    const now = nowIso();
    const exampleInsert = this.database.db.prepare(`INSERT INTO problem_examples
      (id, problem_id, label, sort_order, input_data, expected_output, explanation, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    input.examples.forEach((example) => exampleInsert.run(randomUUID(), problemId, example.label, example.sortOrder, example.inputData, example.expectedOutput, example.explanation ?? null, now));
    const testInsert = this.database.db.prepare(`INSERT INTO problem_test_cases
      (id, problem_id, label, sort_order, input_data, expected_output, hidden, explanation, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    input.testCases.forEach((testCase) => testInsert.run(randomUUID(), problemId, testCase.label, testCase.sortOrder, testCase.inputData, testCase.expectedOutput, testCase.hidden ? 1 : 0, testCase.explanation ?? null, now));
  }

  private toSubmission(row: Row): Submission {
    let caseResults: SubmissionCaseResult[] = [];
    try {
      caseResults = row.result_details_json ? JSON.parse(String(row.result_details_json)) as SubmissionCaseResult[] : [];
    } catch {
      caseResults = [];
    }
    return {
      id: text(row.id),
      problemId: text(row.problem_id),
      submittedLanguage: text(row.submitted_language),
      status: text(row.status) as Submission["status"],
      resultSummary: text(row.result_summary),
      totalRuntimeMillis: row.total_runtime_millis == null ? null : Number(row.total_runtime_millis),
      caseResults,
      createdAt: text(row.created_at),
    };
  }
}

function estimatedReviewMinutes(track: ReviewTrack, difficulty: Problem["difficulty"]): number {
  if (track === "EXPLANATION") {
    return difficulty === "HARD" ? 20 : difficulty === "MEDIUM" ? 15 : 10;
  }
  return difficulty === "HARD" ? 55 : difficulty === "MEDIUM" ? 40 : 25;
}

export interface ProblemInput {
  slug: string;
  title: string;
  summary: string;
  descriptionMarkdown: string;
  constraintsMarkdown?: string | null;
  type: Problem["type"];
  difficulty: Problem["difficulty"];
  starterCode?: string | null;
  referenceSolution?: string | null;
  evaluationNotes?: string | null;
  solutionVideoUrl?: string | null;
  knowledgeRubric: string;
  examples: Array<{ label: string; sortOrder: number; inputData: string; expectedOutput: string; explanation?: string | null }>;
  testCases: Array<{ label: string; sortOrder: number; inputData: string; expectedOutput: string; hidden: boolean; explanation?: string | null }>;
}

function passedIntervalDays(track: ReviewTrack, repetitions: number, previousInterval: number, easeFactor: number, grade: number): number {
  let base: number;
  if (track === "EXPLANATION") {
    base = repetitions === 1 ? (grade >= 5 ? 2 : 1) : repetitions === 2 ? (grade >= 5 ? 4 : 3) : Math.max(1, Math.round(previousInterval * Math.max(1.35, easeFactor * 0.72)));
    return Math.max(1, Math.min(90, base));
  }
  base = repetitions === 1 ? (grade >= 5 ? 4 : 3) : repetitions === 2 ? (grade >= 5 ? 10 : 7) : Math.max(3, Math.round(previousInterval * easeFactor));
  return Math.max(1, Math.min(180, base));
}

function nextEase(currentEase: number, grade: number): number {
  return Math.max(1.3, Math.min(3, currentEase + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))));
}
