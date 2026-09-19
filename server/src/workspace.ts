import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { LocalProblemRunResult, LocalProblemWorkspace, LocalToolingStatus, LocalWorkspaceSettings, Problem } from "./types.js";
import type { ProblemRepository } from "./repository.js";
import { SettingsStore } from "./settings.js";
import { config } from "./config.js";
import { runnerFor, toolingStatus, type RunnerToolPaths } from "./runners.js";
import { classifyError } from "./errors.js";

const marker = ".juro-scaffold";

export class WorkspaceService {
  private activeWorkspace: LocalProblemWorkspace | null = null;
  private activeEditor: ReturnType<typeof spawn> | null = null;

  constructor(private readonly repository: ProblemRepository, private readonly settings: SettingsStore) {}

  toolingStatus(): LocalToolingStatus {
    const current = this.settings.get();
    const workspaceDirectory = path.resolve(current.workspaceDirectory || config.defaultWorkspace);
    let writable = false;
    try {
      fs.mkdirSync(workspaceDirectory, { recursive: true });
      writable = fs.statSync(workspaceDirectory).isDirectory() && fs.accessSync(workspaceDirectory, fs.constants.W_OK) === undefined;
    } catch {
      writable = false;
    }
    return { ...toolingStatus(runnerToolPaths(current)), workspaceConfigured: Boolean(current.workspaceDirectory), workspaceWritable: writable, workspaceDirectory };
  }

  createScaffold(problemId: string): LocalProblemWorkspace {
    const problem = this.repository.getProblem(problemId);
    this.repository.setCurrentProblem(problem.id, "SCAFFOLD_CREATED");
    const scaffold = this.createProblemScaffold(problem);
    const response = this.workspaceResponse(problem, scaffold, false, "READY", null, false, null, "Current workspace rebuilt.");
    this.activeWorkspace = response;
    return response;
  }

  async openInEditor(problemId: string): Promise<LocalProblemWorkspace> {
    const problem = this.repository.getProblem(problemId);
    this.repository.setCurrentProblem(problem.id, "EDITOR_OPENED");
    const scaffold = this.createProblemScaffold(problem);
    this.stopEditor();
    const settings = this.settings.get();
    const editor = editorCommand(settings.editor, settings.editorPath);
    try {
      const editorProcess = await this.launchEditor(editor, scaffold);
      editorProcess.unref();
      this.activeEditor = editorProcess;
      const response = this.workspaceResponse(problem, scaffold, true, "OPEN", editorProcess.pid ?? null, false, new Date().toISOString(), `Opened ${settings.editor === "NVIM" ? "Neovim" : "VS Code"}.`);
      this.activeWorkspace = response;
      return response;
    } catch (error) {
      const launchError = classifyError(error);
      const response = this.workspaceResponse(problem, scaffold, false, "ERROR", null, false, null, `${launchError.message} ${launchError.hint ?? `Choose another editor in Settings and try again.`}`);
      this.activeWorkspace = response;
      return response;
    }
  }

  getActiveWorkspace(): LocalProblemWorkspace {
    // Detached editor launches do not provide reliable close detection. The
    // editor command may exit after handing the workspace to VS Code, so keep
    // the JURO workspace active until the user explicitly clears it.
    if (this.activeWorkspace?.closeDetectionAvailable && this.activeEditor && this.activeEditor.exitCode !== null) {
      this.activeWorkspace = { ...this.activeWorkspace, opened: false, status: "CLOSED", message: "Editor process closed." };
      this.activeEditor = null;
    }
    return this.activeWorkspace ?? {
      problemId: null, title: "", slug: "", scaffoldPath: "", editor: this.settings.get().editor,
      opened: false, status: "NOT_OPEN", processId: null, closeDetectionAvailable: false, launchedAt: null, message: "No active local problem.",
    };
  }

  clearActiveWorkspace(): LocalProblemWorkspace {
    const current = this.getActiveWorkspace();
    this.stopEditor();
    this.activeWorkspace = null;
    return current;
  }

  async runTests(problemId: string, sessionId: string | null = null): Promise<LocalProblemRunResult> {
    const problem = this.repository.getProblem(problemId);
    this.repository.setCurrentProblem(problem.id, "TEST_STARTED");
    const scaffold = this.ensureScaffold(problem);
    const runner = runnerFor(problem.type);
    const source = fs.readFileSync(path.join(scaffold, "src", runner.sourceFilename), "utf8");
    const result = await runner.run(problem, source, scaffold, config.runTimeoutMs, runnerToolPaths(this.settings.get()));
    this.repository.recordProblemTestResult(problem.id, result.status);
    this.repository.recordTestAttempt({
      problemId: problem.id,
      sessionId,
      submittedLanguage: problem.type,
      status: result.status,
      passedCases: result.caseResults.filter((caseResult) => caseResult.passed).length,
      totalCases: result.caseResults.length,
      runtimeMillis: result.runtimeMillis,
    });
    this.activeWorkspace = this.workspaceResponse(problem, scaffold, false, "READY", null, false, null, "Current workspace tested.");
    return { problemId: problem.id, title: problem.title, slug: problem.slug, scaffoldPath: scaffold, ...result };
  }

  async judgeSubmission(problem: Problem, sourceCode: string): Promise<{ status: "ACCEPTED" | "REJECTED"; resultSummary: string; totalRuntimeMillis: number | null; caseResults: LocalProblemRunResult["caseResults"] }> {
    const temp = fs.mkdtempSync(path.join(path.dirname(config.databasePath), "submission-"));
    try {
      const runner = runnerFor(problem.type);
      const result = await runner.run(problem, sourceCode, temp, config.runTimeoutMs, runnerToolPaths(this.settings.get()));
      const status = result.status === "PASSED" ? "ACCEPTED" : "REJECTED";
      return { status, resultSummary: result.status === "PASSED" ? `All ${result.caseResults.length} test cases passed.` : `${result.status}: ${result.stderr || "One or more test cases failed."}`, totalRuntimeMillis: result.runtimeMillis, caseResults: result.caseResults };
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }

  private ensureScaffold(problem: Problem): string {
    const target = this.scaffoldPath();
    if (!fs.existsSync(target) || !this.isScaffoldForProblem(target, problem)) return this.createProblemScaffold(problem);
    return target;
  }

  private createProblemScaffold(problem: Problem): string {
    if (problem.testCases.length < 3) throw new Error(`Problem ${problem.id} must include at least 3 runnable test cases.`);
    const runner = runnerFor(problem.type);
    const target = this.scaffoldPath();
    if (fs.existsSync(target)) {
      if (this.scaffoldProblemId(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        throw new Error(`The current workspace exists and is not managed by JURO: ${target}.`);
      }
    }
    fs.mkdirSync(path.join(target, "tests"), { recursive: true });
    fs.writeFileSync(path.join(target, marker), problem.id);
    runner.createScaffold(problem, target);
    fs.writeFileSync(path.join(target, "README.md"), readme(problem, runner.language));
    fs.writeFileSync(path.join(target, "run.sh"), runScript(runner.language));
    fs.writeFileSync(path.join(target, "run.bat"), runBatchScript(runner.language));
    try { fs.chmodSync(path.join(target, "run.sh"), 0o755); } catch { /* Windows */ }
    return target;
  }

  private scaffoldPath(): string {
    const root = path.resolve(this.settings.get().workspaceDirectory || config.defaultWorkspace);
    const target = path.resolve(root, "juro-current");
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Refusing to operate outside the configured JURO workspace.");
    return target;
  }

  private isScaffoldForProblem(scaffold: string, problem: Problem): boolean {
    return this.scaffoldProblemId(scaffold) === problem.id;
  }

  private scaffoldProblemId(scaffold: string): string | null {
    try {
      const problemId = fs.readFileSync(path.join(scaffold, marker), "utf8").trim();
      return problemId || null;
    } catch {
      return null;
    }
  }

  private launchEditor(editor: string, scaffold: string): Promise<ReturnType<typeof spawn>> {
    return new Promise((resolve, reject) => {
      const editorProcess = spawn(editor, [scaffold], { detached: true, stdio: "ignore" });
      const handleError = (error: Error) => {
        editorProcess.removeListener("spawn", handleSpawn);
        reject(error);
      };
      const handleSpawn = () => {
        editorProcess.removeListener("error", handleError);
        resolve(editorProcess);
      };
      editorProcess.once("error", handleError);
      editorProcess.once("spawn", handleSpawn);
    });
  }

  private workspaceResponse(problem: Problem, scaffoldPath: string, opened: boolean, status: string, processId: number | null, closeDetectionAvailable: boolean, launchedAt: string | null, message: string): LocalProblemWorkspace {
    return { problemId: problem.id, title: problem.title, slug: problem.slug, scaffoldPath, editor: this.settings.get().editor, opened, status, processId, closeDetectionAvailable, launchedAt, message };
  }

  private stopEditor(): void {
    if (this.activeEditor && !this.activeEditor.killed) {
      try { this.activeEditor.kill(); } catch { /* process may already be gone */ }
    }
    this.activeEditor = null;
  }
}

function runnerToolPaths(settings: LocalWorkspaceSettings): RunnerToolPaths {
  return {
    javaRuntimePath: settings.javaRuntimePath,
    javaCompilerPath: settings.javaCompilerPath,
    pythonPath: settings.pythonPath,
    nodePath: settings.nodePath,
    goPath: settings.goPath,
  };
}

function editorCommand(preference: LocalWorkspaceSettings["editor"], configuredPath: string): string {
  const configured = configuredPath.trim();
  if (configured && process.platform === "darwin" && configured.endsWith(".app")) {
    const bundleExecutable = preference === "VS_CODE"
      ? path.join(configured, "Contents", "Resources", "app", "bin", "code")
      : path.join(configured, "Contents", "MacOS", "nvim");
    if (fs.existsSync(bundleExecutable)) return bundleExecutable;
  }
  return configured || (preference === "NVIM" ? "nvim" : "code");
}

function readme(problem: Problem, language: string): string {
  const runnerNote = language === "JAVA"
    ? "Run run.sh to compile and execute the Java solution against all local cases."
    : "The program reads one JSON value from standard input and writes one JSON value to standard output for each run. Run run.sh to execute it manually.";
  return `# ${problem.title}\n\nLanguage: ${language}\nDifficulty: ${problem.difficulty}\n\n${problem.descriptionMarkdown}\n\n${problem.constraintsMarkdown ? `## Constraints\n\n${problem.constraintsMarkdown}\n\n` : ""}## Examples\n\n${problem.examples.map((example) => `### ${example.label}\n\nInput:\n\n${example.inputData}\n\nExpected output:\n\n${example.expectedOutput}\n\n${example.explanation ?? ""}`).join("\n\n")}\n\n${runnerNote}\n`;
}

function runScript(language: string): string {
  const command = language === "JAVA"
    ? "rm -rf target && mkdir -p target && javac -parameters -encoding UTF-8 -d target src/Solution.java src/Main.java && java -cp target Main"
    : language === "PYTHON"
      ? "python3 src/solution.py"
      : language === "JAVASCRIPT"
        ? "node src/solution.js"
        : "GO111MODULE=off go run src/main.go";
  return `#!/usr/bin/env bash\nset -euo pipefail\n${command}\n`;
}

function runBatchScript(language: string): string {
  if (language === "JAVA") return "@echo off\nrmdir /s /q target 2>nul\nmkdir target\njavac -parameters -encoding UTF-8 -d target src\\Solution.java src\\Main.java\nif errorlevel 1 exit /b 1\njava -cp target Main\n";
  if (language === "PYTHON") return "@echo off\npython src\\solution.py\n";
  if (language === "JAVASCRIPT") return "@echo off\nnode src\\solution.js\n";
  return "@echo off\nset GO111MODULE=off\ngo run src\\main.go\n";
}
