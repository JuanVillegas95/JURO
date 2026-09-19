import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runnerFor } from "../src/runners.js";
import type { Problem } from "../src/types.js";

function javascriptProblem(): Problem {
  return {
    id: "test-problem",
    slug: "test-problem",
    title: "Test problem",
    summary: "A runner test",
    descriptionMarkdown: "",
    constraintsMarkdown: null,
    type: "JAVASCRIPT",
    difficulty: "EASY",
    starterCode: null,
    referenceSolution: null,
    evaluationNotes: null,
    solutionVideoUrl: null,
    knowledgeRubric: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    examples: [],
    testCases: [
      {
        id: "case-1",
        label: "Visible 1",
        sortOrder: 0,
        inputData: '{"value":2}',
        expectedOutput: "4",
        hidden: false,
        explanation: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

test("javascript runner reports passing JSON cases", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "juro-runner-test-"));
  try {
    const source = `let input = "";\nprocess.stdin.on("data", (chunk) => input += chunk);\nprocess.stdin.on("end", () => process.stdout.write(String(JSON.parse(input).value * 2)));\n`;
    const result = await runnerFor("JAVASCRIPT").run(javascriptProblem(), source, directory, 2_000, { nodePath: process.execPath });
    assert.equal(result.status, "PASSED");
    assert.equal(result.caseResults[0]?.passed, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runner kills a process that exceeds its timeout", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "juro-runner-timeout-"));
  try {
    const source = `while (true) {}`;
    const result = await runnerFor("JAVASCRIPT").run(javascriptProblem(), source, directory, 250);
    assert.equal(result.status, "TIMEOUT");
    assert.equal(result.exitCode, -1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
