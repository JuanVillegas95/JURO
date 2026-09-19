import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

const schemaSql = `
CREATE TABLE IF NOT EXISTS problems (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description_markdown TEXT NOT NULL,
  constraints_markdown TEXT,
  type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  starter_code TEXT,
  reference_solution TEXT,
  evaluation_notes TEXT,
  solution_video_url TEXT,
  knowledge_rubric TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problem_examples (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  input_data TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problem_test_cases (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  input_data TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  submitted_language TEXT NOT NULL,
  source_code TEXT NOT NULL,
  status TEXT NOT NULL,
  result_summary TEXT NOT NULL,
  total_runtime_millis INTEGER,
  result_details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS problem_review_states (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  status TEXT NOT NULL,
  due_at TEXT NOT NULL,
  last_reviewed_at TEXT,
  interval_days INTEGER NOT NULL,
  ease_factor REAL NOT NULL,
  repetitions INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  last_result TEXT,
  priority_score REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(problem_id, track)
);

CREATE TABLE IF NOT EXISTS current_problem_context (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  last_action TEXT NOT NULL,
  last_test_status TEXT,
  last_test_at TEXT,
  last_knowledge_status TEXT,
  last_knowledge_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_check_sessions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'STARTED',
  transcript TEXT NOT NULL DEFAULT '',
  evaluation_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  problem_id TEXT REFERENCES problems(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  track TEXT NOT NULL DEFAULT 'CODING',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  started_at TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  ended_at TEXT,
  active_time_millis INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_attempts (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES practice_sessions(id) ON DELETE SET NULL,
  submitted_language TEXT NOT NULL,
  status TEXT NOT NULL,
  passed_cases INTEGER NOT NULL DEFAULT 0,
  total_cases INTEGER NOT NULL DEFAULT 0,
  runtime_millis INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_history (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES practice_sessions(id) ON DELETE SET NULL,
  track TEXT NOT NULL,
  passed INTEGER NOT NULL,
  previous_status TEXT,
  previous_due_at TEXT,
  new_status TEXT NOT NULL,
  new_due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_check_history (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES practice_sessions(id) ON DELETE SET NULL,
  knowledge_session_id TEXT NOT NULL UNIQUE REFERENCES knowledge_check_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  score REAL NOT NULL,
  summary TEXT NOT NULL,
  evaluation_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_problem ON practice_sessions(problem_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_attempts_problem ON test_attempts(problem_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_history_problem ON review_history(problem_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_history_problem ON knowledge_check_history(problem_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const seededProblem = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "two-sum",
  title: "Two Sum",
  summary: "Return the two indexes that add up to the target.",
  descriptionMarkdown: "Given an integer array nums and an integer target, return the indexes of the two values whose sum equals target.",
  constraintsMarkdown: "- nums contains at least two values.\n- Exactly one valid answer exists.\n- Return indexes in ascending order.",
  type: "JAVA",
  difficulty: "EASY",
  starterCode: `class Solution {
    public int[] solve(int[] nums, int target) {
        return new int[0];
    }
}`,
  referenceSolution: `class Solution {
    public int[] solve(int[] nums, int target) {
        java.util.Map<Integer, Integer> seen = new java.util.HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] { seen.get(complement), i };
            }
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}`,
  evaluationNotes: "Use a hash map for expected linear time and explain the complement lookup invariant.",
  solutionVideoUrl: null,
  knowledgeRubric: "A strong explanation identifies the complement lookup, the hash map invariant, duplicate handling, the no-answer guard, and O(n) time with O(n) space.",
  examples: [
    ["Example 1", 0, '{"nums":[2,7,11,15],"target":9}', "[0,1]", "Indexes 0 and 1 contain values that sum to 9."],
    ["Example 2", 1, '{"nums":[3,2,4],"target":6}', "[1,2]", "Values 2 and 4 produce the target."],
    ["Example 3", 2, '{"nums":[0,4,3,0],"target":0}', "[0,3]", "The two zero values are the valid pair."],
  ],
  testCases: [
    ["Visible 1", 0, '{"nums":[2,7,11,15],"target":9}', "[0,1]", 0],
    ["Visible 2", 1, '{"nums":[3,2,4],"target":6}', "[1,2]", 0],
    ["Hidden 1", 2, '{"nums":[3,3],"target":6}', "[0,1]", 1],
  ],
} as const;

export class JuroDatabase {
  db: DatabaseSync;
  readonly databasePath: string;

  constructor(databasePath = config.databasePath) {
    this.databasePath = path.resolve(databasePath);
    this.db = this.openDatabase();
    this.initialize();
  }

  private openDatabase(): DatabaseSync {
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    return new DatabaseSync(this.databasePath, {
      enableForeignKeyConstraints: true,
      timeout: 5000,
    });
  }

  private initialize(): void {
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(schemaSql);
    this.seedIfEmpty();
    this.backfillActivityEvents();
    this.backfillProgressHistory();
  }

  transaction<T>(work: () => T): T {
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      const result = work();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }

  close(): void {
    if (this.db.isOpen) this.db.close();
  }

  checkpoint(): void {
    if (this.db.isOpen) this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  }

  replaceFromFile(sourcePath: string): void {
    const targetPath = this.databasePath;
    const rollbackPath = `${targetPath}.restore-rollback-${randomUUID()}`;
    this.checkpoint();
    this.close();

    try {
      if (fs.existsSync(targetPath)) fs.renameSync(targetPath, rollbackPath);
      for (const suffix of ["-wal", "-shm"]) {
        const targetSidecar = `${targetPath}${suffix}`;
        const rollbackSidecar = `${rollbackPath}${suffix}`;
        if (fs.existsSync(targetSidecar)) fs.renameSync(targetSidecar, rollbackSidecar);
      }
      fs.renameSync(sourcePath, targetPath);
      this.db = this.openDatabase();
      this.initialize();
      for (const suffix of ["-wal", "-shm"]) {
        const rollbackSidecar = `${rollbackPath}${suffix}`;
        if (fs.existsSync(rollbackSidecar)) fs.rmSync(rollbackSidecar, { force: true });
      }
      if (fs.existsSync(rollbackPath)) fs.rmSync(rollbackPath, { force: true });
    } catch (error) {
      try { if (this.db.isOpen) this.db.close(); } catch { /* preserve the original restore error */ }
      if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
      for (const suffix of ["-wal", "-shm"]) {
        const targetSidecar = `${targetPath}${suffix}`;
        if (fs.existsSync(targetSidecar)) fs.rmSync(targetSidecar, { force: true });
      }
      if (fs.existsSync(rollbackPath)) fs.renameSync(rollbackPath, targetPath);
      for (const suffix of ["-wal", "-shm"]) {
        const rollbackSidecar = `${rollbackPath}${suffix}`;
        const targetSidecar = `${targetPath}${suffix}`;
        if (fs.existsSync(rollbackSidecar)) fs.renameSync(rollbackSidecar, targetSidecar);
      }
      this.db = this.openDatabase();
      this.initialize();
      throw error;
    }
  }

  private seedIfEmpty(): void {
    const initialized = this.db.prepare("SELECT value FROM app_metadata WHERE key = 'catalog_seeded'").get() as { value: string } | undefined;
    if (initialized) return;
    const existing = this.db.prepare("SELECT COUNT(*) AS count FROM problems").get() as { count: number };
    if (Number(existing.count) > 0) {
      this.db.prepare("INSERT INTO app_metadata (key, value) VALUES ('catalog_seeded', '1')").run();
      return;
    }

    const now = new Date().toISOString();
    this.transaction(() => {
      this.db.prepare(`INSERT INTO problems
        (id, slug, title, summary, description_markdown, constraints_markdown, type, difficulty,
         starter_code, reference_solution, evaluation_notes, solution_video_url, knowledge_rubric, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(seededProblem.id, seededProblem.slug, seededProblem.title, seededProblem.summary,
          seededProblem.descriptionMarkdown, seededProblem.constraintsMarkdown, seededProblem.type,
          seededProblem.difficulty, seededProblem.starterCode, seededProblem.referenceSolution,
          seededProblem.evaluationNotes, seededProblem.solutionVideoUrl, seededProblem.knowledgeRubric, now, now);

      const exampleInsert = this.db.prepare(`INSERT INTO problem_examples
        (id, problem_id, label, sort_order, input_data, expected_output, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      seededProblem.examples.forEach(([label, sortOrder, inputData, expectedOutput, explanation], index) => {
        exampleInsert.run(`21111111-1111-1111-1111-11111111111${index + 1}`, seededProblem.id, label, sortOrder, inputData, expectedOutput, explanation, now);
      });

      const testInsert = this.db.prepare(`INSERT INTO problem_test_cases
        (id, problem_id, label, sort_order, input_data, expected_output, hidden, explanation, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      seededProblem.testCases.forEach(([label, sortOrder, inputData, expectedOutput, hidden], index) => {
        testInsert.run(`31111111-1111-1111-1111-11111111111${index + 1}`, seededProblem.id, label, sortOrder, inputData, expectedOutput, hidden, null, now);
      });

      const reviewInsert = this.db.prepare(`INSERT INTO problem_review_states
        (id, problem_id, track, status, due_at, interval_days, ease_factor, repetitions, lapses, priority_score, created_at, updated_at)
        VALUES (?, ?, ?, 'NEW', ?, 0, 2.5, 0, 0, ?, ?, ?)`);
      reviewInsert.run(randomUUID(), seededProblem.id, "CODING", now, 1.5, now, now);
      reviewInsert.run(randomUUID(), seededProblem.id, "EXPLANATION", now, 2.0, now, now);
      this.db.prepare("INSERT INTO app_metadata (key, value) VALUES ('catalog_seeded', '1')").run();
    });
  }

  private backfillActivityEvents(): void {
    const initialized = this.db.prepare("SELECT value FROM app_metadata WHERE key = 'activity_backfilled_v1'").get() as { value: string } | undefined;
    if (initialized) return;

    this.transaction(() => {
      const insert = this.db.prepare("INSERT INTO activity_events (id, problem_id, kind, occurred_at) VALUES (?, ?, ?, ?)");
      const problems = this.db.prepare("SELECT id, created_at FROM problems").all() as Array<{ id: string; created_at: string }>;
      for (const problem of problems) {
        insert.run(randomUUID(), problem.id, "PROBLEM_CREATED", problem.created_at);
      }

      const submissions = this.db.prepare("SELECT id, problem_id, created_at FROM submissions").all() as Array<{ id: string; problem_id: string; created_at: string }>;
      for (const submission of submissions) {
        insert.run(randomUUID(), submission.problem_id, "SUBMISSION", submission.created_at);
      }

      const knowledgeChecks = this.db.prepare("SELECT problem_id, created_at, completed_at FROM knowledge_check_sessions").all() as Array<{ problem_id: string; created_at: string; completed_at: string | null }>;
      for (const session of knowledgeChecks) {
        insert.run(randomUUID(), session.problem_id, "KNOWLEDGE_CHECK", session.created_at);
        if (session.completed_at) insert.run(randomUUID(), session.problem_id, "KNOWLEDGE_REVIEW", session.completed_at);
      }

      const reviews = this.db.prepare("SELECT problem_id, track, last_reviewed_at FROM problem_review_states WHERE last_reviewed_at IS NOT NULL").all() as Array<{ problem_id: string; track: string; last_reviewed_at: string }>;
      for (const review of reviews) {
        insert.run(randomUUID(), review.problem_id, `${review.track}_REVIEW`, review.last_reviewed_at);
      }

      this.db.prepare("INSERT INTO app_metadata (key, value) VALUES ('activity_backfilled_v1', '1')").run();
    });
  }

  private backfillProgressHistory(): void {
    const initialized = this.db.prepare("SELECT value FROM app_metadata WHERE key = 'progress_history_backfilled_v1'").get() as { value: string } | undefined;
    if (initialized) return;

    this.transaction(() => {
      const testInsert = this.db.prepare(`INSERT OR IGNORE INTO test_attempts
        (id, problem_id, session_id, submitted_language, status, passed_cases, total_cases, runtime_millis, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`);
      const submissions = this.db.prepare("SELECT id, problem_id, submitted_language, status, total_runtime_millis, result_details_json, created_at FROM submissions").all() as Array<Record<string, unknown>>;
      for (const submission of submissions) {
        let passedCases = 0;
        let totalCases = 0;
        try {
          const cases = submission.result_details_json ? JSON.parse(String(submission.result_details_json)) as Array<{ passed?: boolean }> : [];
          totalCases = cases.length;
          passedCases = cases.filter((item) => item.passed).length;
        } catch {
          // Older submissions may not have structured case output.
        }
        testInsert.run(`submission-${String(submission.id)}`, String(submission.problem_id), String(submission.submitted_language), String(submission.status), passedCases, totalCases, Number(submission.total_runtime_millis ?? 0), String(submission.created_at));
      }

      const reviewInsert = this.db.prepare(`INSERT OR IGNORE INTO review_history
        (id, problem_id, session_id, track, passed, previous_status, previous_due_at, new_status, new_due_at, interval_days, created_at)
        VALUES (?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?)`);
      const reviews = this.db.prepare("SELECT problem_id, track, status, due_at, last_reviewed_at, last_result, interval_days FROM problem_review_states WHERE last_reviewed_at IS NOT NULL").all() as Array<Record<string, unknown>>;
      for (const review of reviews) {
        const reviewedAt = String(review.last_reviewed_at);
        reviewInsert.run(`review-${String(review.problem_id)}-${String(review.track)}-${reviewedAt}`, String(review.problem_id), String(review.track), review.last_result === "PASSED" ? 1 : 0, String(review.status), String(review.due_at), Number(review.interval_days), reviewedAt);
      }

      const knowledgeInsert = this.db.prepare(`INSERT OR IGNORE INTO knowledge_check_history
        (id, problem_id, session_id, knowledge_session_id, status, score, summary, evaluation_json, created_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`);
      const knowledgeChecks = this.db.prepare("SELECT id, problem_id, status, evaluation_json, completed_at, created_at FROM knowledge_check_sessions WHERE evaluation_json IS NOT NULL").all() as Array<Record<string, unknown>>;
      for (const check of knowledgeChecks) {
        let evaluation: { score?: number; summary?: string; status?: string } = {};
        try { evaluation = JSON.parse(String(check.evaluation_json)) as typeof evaluation; } catch { /* leave defaults */ }
        knowledgeInsert.run(`knowledge-${String(check.id)}`, String(check.problem_id), String(check.id), evaluation.status ?? String(check.status), Number(evaluation.score ?? 0), String(evaluation.summary ?? ""), String(check.evaluation_json), String(check.completed_at ?? check.created_at));
      }

      this.db.prepare("INSERT INTO app_metadata (key, value) VALUES ('progress_history_backfilled_v1', '1')").run();
    });
  }
}
