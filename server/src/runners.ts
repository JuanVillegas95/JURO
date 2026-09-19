import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import type { Problem, ProblemType, SubmissionCaseResult, ToolCommandStatus } from "./types.js";

export type SupportedLanguage = "JAVA" | "PYTHON" | "JAVASCRIPT" | "GO";
export type RunnerStatus = "PASSED" | "FAILED" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIMEOUT" | "TOOLCHAIN_UNAVAILABLE";
export const supportedLanguages: SupportedLanguage[] = ["JAVA", "PYTHON", "JAVASCRIPT", "GO"];

export interface RunnerToolPaths {
  javaRuntimePath?: string | null;
  javaCompilerPath?: string | null;
  pythonPath?: string | null;
  nodePath?: string | null;
  goPath?: string | null;
}

export interface RunnerResult {
  status: RunnerStatus;
  exitCode: number;
  runtimeMillis: number;
  stdout: string;
  stderr: string;
  caseResults: SubmissionCaseResult[];
}

export interface LanguageRunner {
  language: SupportedLanguage;
  sourceFilename: string;
  createScaffold(problem: Problem, directory: string): void;
  run(problem: Problem, sourceCode: string, directory: string, timeoutMs: number, toolPaths?: RunnerToolPaths): Promise<RunnerResult>;
}

const outputLimit = 1_000_000;

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value === "JAVA" || value === "PYTHON" || value === "JAVASCRIPT" || value === "GO";
}

export function runnerFor(value: ProblemType | string): LanguageRunner {
  switch (value) {
    case "JAVA": return javaRunner;
    case "PYTHON": return pythonRunner;
    case "JAVASCRIPT": return javascriptRunner;
    case "GO": return goRunner;
    default: throw new Error(`Unsupported problem language: ${value}. Supported languages are Java, Python, JavaScript, and Go.`);
  }
}

export function toolingStatus(paths: RunnerToolPaths = {}): {
  javaRuntime: ToolCommandStatus;
  javaCompiler: ToolCommandStatus;
  maven: ToolCommandStatus;
  python: ToolCommandStatus;
  node: ToolCommandStatus;
  go: ToolCommandStatus;
} {
  return {
    javaRuntime: commandStatus("java", configuredCommand(paths.javaRuntimePath, "java"), "-version"),
    javaCompiler: commandStatus("javac", configuredCommand(paths.javaCompilerPath, "javac"), "-version"),
    maven: commandStatus("maven", "mvn", "-version"),
    python: pythonStatus(paths.pythonPath),
    node: commandStatus("node", configuredCommand(paths.nodePath, "node"), "--version"),
    go: commandStatus("go", configuredCommand(paths.goPath, "go"), "version"),
  };
}

function configuredCommand(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function commandStatus(name: string, command: string, ...args: string[]): ToolCommandStatus {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5000 });
  const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const unavailableDetail = result.error && "code" in result.error && result.error.code === "ENOENT"
    ? `${toolLabel(name)} was not found ${path.isAbsolute(command) ? `at ${command}` : "on PATH"}. ${installHint(name)}`
    : result.error instanceof Error
      ? result.error.message
      : "Command unavailable.";
  return {
    name,
    available: result.status === 0,
    version: detail.split(/\r?\n/)[0] || "Unavailable",
    detail: detail || unavailableDetail,
  };
}

function pythonCommand(override?: string | null): string | null {
  for (const candidate of override?.trim() ? [override.trim()] : ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (result.status === 0) return candidate;
  }
  return null;
}

function pythonStatus(override?: string | null): ToolCommandStatus {
  const command = pythonCommand(override);
  return command ? commandStatus("python", command, "--version") : {
    name: "python",
    available: false,
    version: "Unavailable",
    detail: override?.trim()
      ? `Python was not found at ${override.trim()}. Check the executable path or clear it to use PATH detection.`
      : "Python was not found on PATH. Install Python 3 or restart JURO after updating your PATH.",
  };
}

function unavailable(language: SupportedLanguage, paths: RunnerToolPaths = {}): RunnerResult {
  const tool = language === "JAVA" ? "Java (java and javac)" : language === "PYTHON" ? "Python" : language === "JAVASCRIPT" ? "Node.js" : "Go";
  const configuredPath = language === "JAVA" ? paths.javaCompilerPath || paths.javaRuntimePath : language === "PYTHON" ? paths.pythonPath : language === "JAVASCRIPT" ? paths.nodePath : paths.goPath;
  const install = language === "JAVA"
    ? "Install a JDK 17+ (java and javac)"
    : language === "PYTHON"
      ? "Install Python 3"
      : language === "JAVASCRIPT"
        ? "Install Node.js"
        : "Install Go";
  return {
    status: "TOOLCHAIN_UNAVAILABLE",
    exitCode: -1,
    runtimeMillis: 0,
    stdout: "",
    stderr: configuredPath?.trim()
      ? `${tool} was not found at ${configuredPath.trim()}. Clear the custom path or choose the correct executable.`
      : `${tool} was not found on PATH. ${install} or restart JURO after updating your PATH.`,
    caseResults: [],
  };
}

function toolLabel(name: string): string {
  if (name === "python") return "Python";
  if (name === "node") return "Node.js";
  if (name === "go") return "Go";
  if (name === "javaRuntime" || name === "javaCompiler") return "Java";
  if (name === "maven") return "Maven";
  return name;
}

function installHint(name: string): string {
  if (name === "python") return "Install Python 3 or restart JURO after updating your PATH.";
  if (name === "node") return "Install Node.js or restart JURO after updating your PATH.";
  if (name === "go") return "Install Go or restart JURO after updating your PATH.";
  if (name === "javaRuntime" || name === "javaCompiler") return "Install a JDK 17+ or restart JURO after updating your PATH.";
  if (name === "maven") return "Install Maven or restart JURO after updating your PATH.";
  return "Install the required tool or restart JURO after updating your PATH.";
}

function javaAvailable(paths: RunnerToolPaths = {}): boolean {
  return commandStatus("java", configuredCommand(paths.javaRuntimePath, "java"), "-version").available && commandStatus("javac", configuredCommand(paths.javaCompilerPath, "javac"), "-version").available;
}

const javaRunner: LanguageRunner = {
  language: "JAVA",
  sourceFilename: "Solution.java",
  createScaffold(problem, directory) {
    fs.mkdirSync(path.join(directory, "src"), { recursive: true });
    fs.writeFileSync(path.join(directory, "src", "Solution.java"), problem.starterCode || defaultJavaStarter);
    fs.writeFileSync(path.join(directory, "src", "Main.java"), mainJava(problem));
  },
  async run(problem, sourceCode, directory, timeoutMs, paths = {}) {
    if (!javaAvailable(paths)) return unavailable("JAVA", paths);
    fs.mkdirSync(path.join(directory, "src"), { recursive: true });
    fs.mkdirSync(path.join(directory, "target"), { recursive: true });
    fs.writeFileSync(path.join(directory, "src", "Solution.java"), sourceCode);
    fs.writeFileSync(path.join(directory, "src", "Main.java"), mainJava(problem));
    const compile = await runCommand(configuredCommand(paths.javaCompilerPath, "javac"), ["-parameters", "-encoding", "UTF-8", "-d", "target", "src/Solution.java", "src/Main.java"], directory, timeoutMs);
    if (compile.timedOut) return resultFromCommand("TIMEOUT", compile, "Compilation exceeded the configured timeout.");
    if (compile.exitCode !== 0) return resultFromCommand("COMPILE_ERROR", compile);
    const execution = await runCommand(configuredCommand(paths.javaRuntimePath, "java"), ["-cp", "target", "Main"], directory, timeoutMs);
    const caseResults = parseCaseResults(execution.stdout);
    const status: RunnerStatus = execution.timedOut
      ? "TIMEOUT"
      : execution.exitCode !== 0 && caseResults.length === 0
        ? "RUNTIME_ERROR"
        : caseResults.length > 0 && caseResults.every((item) => item.passed) && execution.exitCode === 0
          ? "PASSED"
          : "FAILED";
    return { status, exitCode: execution.timedOut ? -1 : execution.exitCode, runtimeMillis: compile.runtimeMillis + execution.runtimeMillis, stdout: execution.stdout, stderr: execution.stderr, caseResults };
  },
};

const pythonRunner: LanguageRunner = jsonStdinRunner("PYTHON", "solution.py", "python");
const javascriptRunner: LanguageRunner = jsonStdinRunner("JAVASCRIPT", "solution.js", "javascript");
const goRunner: LanguageRunner = jsonStdinRunner("GO", "main.go", "go");

function jsonStdinRunner(language: SupportedLanguage, sourceFilename: string, kind: "python" | "javascript" | "go"): LanguageRunner {
  return {
    language,
    sourceFilename,
    createScaffold(problem, directory) {
      fs.mkdirSync(path.join(directory, "src"), { recursive: true });
      fs.writeFileSync(path.join(directory, "src", sourceFilename), problem.starterCode || defaultStarter(language));
    },
    async run(problem, sourceCode, directory, timeoutMs, paths = {}) {
      const available = kind === "python" ? pythonCommand(paths.pythonPath) !== null : kind === "javascript" ? commandStatus("node", configuredCommand(paths.nodePath, "node"), "--version").available : commandStatus("go", configuredCommand(paths.goPath, "go"), "version").available;
      if (!available) return unavailable(language, paths);
      fs.mkdirSync(path.join(directory, "src"), { recursive: true });
      fs.writeFileSync(path.join(directory, "src", sourceFilename), sourceCode);

      let executable = kind === "python" ? pythonCommand(paths.pythonPath) : kind === "javascript" ? configuredCommand(paths.nodePath, "node") : null;
      if (kind === "go") {
        executable = path.join(directory, ".juro-solution");
        const compile = await runCommand(configuredCommand(paths.goPath, "go"), ["build", "-o", executable, path.join("src", sourceFilename)], directory, timeoutMs);
        if (compile.timedOut) return resultFromCommand("TIMEOUT", compile, "Compilation exceeded the configured timeout.");
        if (compile.exitCode !== 0) return resultFromCommand("COMPILE_ERROR", compile);
      }
      if (!executable) return unavailable(language, paths);

      const caseResults: SubmissionCaseResult[] = [];
      let stdout = "";
      let stderr = "";
      let totalRuntimeMillis = kind === "go" ? 0 : 0;
      for (const testCase of problem.testCases.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
        const started = Date.now();
        const args = kind === "python" ? [path.join("src", sourceFilename)] : kind === "javascript" ? [path.join("src", sourceFilename)] : [];
        const execution = await runCommand(executable, args, directory, timeoutMs, `${testCase.inputData}\n`);
        const runtimeMillis = Date.now() - started;
        totalRuntimeMillis += runtimeMillis;
        stdout += execution.stdout;
        stderr += execution.stderr;
        const expected = parseJson(testCase.expectedOutput);
        const actual = parseLastJson(execution.stdout);
        const timedOut = execution.timedOut;
        const runtimeError = execution.exitCode !== 0;
        const passed = !timedOut && !runtimeError && expected.ok && actual.ok && valuesEqual(actual.value, expected.value);
        const note = timedOut
          ? "The test exceeded the configured timeout."
          : runtimeError
            ? execution.stderr.trim() || "The program exited with a non-zero status."
            : !actual.ok
              ? "The program did not emit valid JSON output."
              : passed
                ? "Actual output matched the expected result."
                : "Actual output did not match the expected result.";
        caseResults.push({ label: testCase.label, passed, inputData: testCase.inputData, expectedOutput: testCase.expectedOutput, actualOutput: actual.ok ? JSON.stringify(actual.value) : execution.stdout.trim(), note, runtimeMillis });
        if (timedOut) return { status: "TIMEOUT", exitCode: -1, runtimeMillis: totalRuntimeMillis, stdout, stderr, caseResults };
      }
      const status: RunnerStatus = caseResults.length > 0 && caseResults.every((item) => item.passed) ? "PASSED" : stderr.trim() && caseResults.every((item) => !item.passed) ? "RUNTIME_ERROR" : "FAILED";
      return { status, exitCode: status === "PASSED" ? 0 : 1, runtimeMillis: totalRuntimeMillis, stdout, stderr, caseResults };
    },
  };
}

function resultFromCommand(status: RunnerStatus, command: CommandResult, stderrOverride?: string): RunnerResult {
  return { status, exitCode: command.timedOut ? -1 : command.exitCode, runtimeMillis: command.runtimeMillis, stdout: command.stdout, stderr: stderrOverride || command.stderr, caseResults: [] };
}

interface CommandResult { exitCode: number; stdout: string; stderr: string; runtimeMillis: number; timedOut: boolean; }

function runCommand(commandName: string, args: string[], cwd: string, timeoutMs: number, input?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(commandName, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
      env: runnerEnvironment(),
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, stdout, stderr, runtimeMillis: Date.now() - started, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, timeoutMs);
    child.stdin.on("error", () => { /* the program may exit before consuming all input */ });
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk.toString()}`.slice(0, outputLimit); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk.toString()}`.slice(0, outputLimit); });
    child.on("error", (error) => { clearTimeout(timer); stderr = error.message; finish(-1); });
    child.on("close", (exitCode) => { clearTimeout(timer); finish(exitCode ?? -1); });
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

function runnerEnvironment(): NodeJS.ProcessEnv {
  const secretLike = /(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i;
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key === "PATH" || key === "HOME" || key === "USER" || key === "LANG" || !secretLike.test(key)),
  );
  return { ...environment, CI: "1", GO111MODULE: "off", JURO_RUNNER: "1" };
}

function killProcessTree(child: ChildProcess): void {
  if (child.exitCode !== null) return;
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch {
      // Fall back to the direct child when the process group is already gone.
    }
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // The process may have exited between the timeout and the kill attempt.
  }
}

function parseJson(value: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: JSON.parse(value) }; } catch { return { ok: false }; }
}

function parseLastJson(value: string): { ok: true; value: unknown } | { ok: false } {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse();
  for (const line of lines) {
    const parsed = parseJson(line);
    if (parsed.ok) return parsed;
  }
  return { ok: false };
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" && typeof expected === "number") return Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) < 1e-9;
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.length === expected.length && actual.every((item, index) => valuesEqual(item, expected[index]));
  if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(e).length && keys.every((key) => key in e && valuesEqual(a[key], e[key]));
  }
  return Object.is(actual, expected);
}

function parseCaseResults(stdout: string): SubmissionCaseResult[] {
  const results: SubmissionCaseResult[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("JURO_CASE ")) continue;
    try { results.push(JSON.parse(line.slice("JURO_CASE ".length)) as SubmissionCaseResult); } catch { /* ignore malformed runner output */ }
  }
  return results;
}

function defaultStarter(language: SupportedLanguage): string {
  if (language === "PYTHON") return `import json\nimport sys\n\ndef solve(data):\n    return None\n\nif __name__ == "__main__":\n    print(json.dumps(solve(json.load(sys.stdin)), separators=(",", ":")))\n`;
  if (language === "JAVASCRIPT") return `function solve(data) {\n  return null;\n}\n\nlet input = "";\nprocess.stdin.setEncoding("utf8");\nprocess.stdin.on("data", (chunk) => { input += chunk; });\nprocess.stdin.on("end", () => {\n  process.stdout.write(JSON.stringify(solve(JSON.parse(input))));\n});\n`;
  return `package main\n\nimport (\n  "encoding/json"\n  "os"\n)\n\nfunc solve(data any) any {\n  return nil\n}\n\nfunc main() {\n  var input any\n  if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil { panic(err) }\n  if err := json.NewEncoder(os.Stdout).Encode(solve(input)); err != nil { panic(err) }\n}\n`;
}

const defaultJavaStarter = `class Solution {\n    public int solve(int value) {\n        return 0;\n    }\n}\n`;

function mainJava(problem: Problem): string {
  const signature = parseSignature(problem.starterCode || problem.referenceSolution || "");
  const cases = problem.testCases.slice().sort((a, b) => a.sortOrder - b.sortOrder).map((testCase) => {
    const input = JSON.parse(testCase.inputData) as unknown;
    const expected = JSON.parse(testCase.expectedOutput) as unknown;
    const values = signature.parameters.map((parameter, index) => javaLiteral(parameter.type, resolveParameter(input, parameter.name, index)));
    return `        runCase(${quoteJava(testCase.label)}, ${quoteJava(testCase.inputData)}, () -> solution.solve(${values.join(", ")}), ${javaLiteral(signature.returnType, expected)});`;
  }).join("\n");
  return `import java.util.Arrays;\nimport java.util.Objects;\n\npublic class Main {\n  private static int passedCount = 0;\n  private static int totalCount = 0;\n  @FunctionalInterface interface CaseRunner { Object run() throws Exception; }\n  public static void main(String[] args) throws Exception {\n    Solution solution = new Solution();\n${cases}\n    String status = passedCount == totalCount ? "PASSED" : "FAILED";\n    System.out.println("JURO_RESULT " + jsonResult(status, passedCount, totalCount));\n    if (passedCount != totalCount) System.exit(1);\n  }\n  private static void runCase(String label, String inputData, CaseRunner runner, Object expected) {\n    totalCount++; long startedAt = System.nanoTime(); boolean passed = false; String actualOutput; String note;\n    try { Object actual = runner.run(); passed = valuesEqual(actual, expected); if (passed) passedCount++; actualOutput = formatValue(actual); note = passed ? "Actual output matched the expected result." : "Actual output did not match the expected result."; }\n    catch (Throwable throwable) { actualOutput = "Runtime error: " + throwable.getClass().getSimpleName(); note = throwable.getMessage() == null ? "The submitted code threw an exception." : throwable.getMessage(); }\n    long runtimeMillis = (System.nanoTime() - startedAt) / 1000000L;\n    System.out.println("JURO_CASE " + jsonCase(label, passed, inputData, formatValue(expected), actualOutput, note, runtimeMillis));\n  }\n  private static boolean valuesEqual(Object actual, Object expected) {\n    if (actual instanceof int[] a && expected instanceof int[] e) return Arrays.equals(a, e);\n    if (actual instanceof long[] a && expected instanceof long[] e) return Arrays.equals(a, e);\n    if (actual instanceof double[] a && expected instanceof double[] e) return Arrays.equals(a, e);\n    if (actual instanceof boolean[] a && expected instanceof boolean[] e) return Arrays.equals(a, e);\n    if (actual instanceof Object[] a && expected instanceof Object[] e) return Arrays.deepEquals(a, e);\n    if (actual instanceof Number a && expected instanceof Number e) return Math.abs(a.doubleValue() - e.doubleValue()) < 0.000000001d;\n    return Objects.equals(actual, expected);\n  }\n  private static String formatValue(Object value) { if (value == null) return "null"; if (value instanceof int[] a) return Arrays.toString(a); if (value instanceof long[] a) return Arrays.toString(a); if (value instanceof double[] a) return Arrays.toString(a); if (value instanceof boolean[] a) return Arrays.toString(a); if (value instanceof Object[] a) return Arrays.deepToString(a); return String.valueOf(value); }\n  private static String jsonResult(String status, int passed, int total) { return "{\\"status\\":" + json(status) + ",\\"passed\\":" + passed + ",\\"total\\":" + total + "}"; }\n  private static String jsonCase(String label, boolean passed, String inputData, String expectedOutput, String actualOutput, String note, long runtimeMillis) { return "{\\"label\\":" + json(label) + ",\\"passed\\":" + passed + ",\\"inputData\\":" + json(inputData) + ",\\"expectedOutput\\":" + json(expectedOutput) + ",\\"actualOutput\\":" + json(actualOutput) + ",\\"note\\":" + json(note) + ",\\"runtimeMillis\\":" + runtimeMillis + "}"; }\n  private static String json(String value) { if (value == null) return "null"; return "\\\"" + value.replace("\\\\", "\\\\\\\\").replace("\\\"", "\\\\\\\"").replace("\\n", "\\\\n").replace("\\r", "\\\\r").replace("\\t", "\\\\t") + "\\\""; }\n}\n`;
}

function parseSignature(source: string): { returnType: string; parameters: Array<{ type: string; name: string }> } {
  const match = /public\s+([\w<>\[\]]+)\s+solve\s*\(([^)]*)\)/m.exec(source);
  if (!match) throw new Error("Problem does not have a Java solve method signature.");
  const parameters = match[2].trim() ? match[2].split(",").map((value) => { const pieces = value.trim().split(/\s+/); if (pieces.length < 2) throw new Error(`Unable to parse Java parameter '${value}'.`); return { type: pieces[0], name: pieces[1] }; }) : [];
  return { returnType: match[1], parameters };
}

function resolveParameter(input: unknown, name: string, index: number): unknown {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    if (name in record) return record[name];
    return Object.values(record)[index];
  }
  if (Array.isArray(input)) return input[index];
  return input;
}

function javaLiteral(type: string, value: unknown): string {
  if (type === "int") return String(Number(value));
  if (type === "long") return `${Number(value)}L`;
  if (type === "double") return `${Number(value)}d`;
  if (type === "boolean") return String(Boolean(value));
  if (type === "String") return quoteJava(String(value));
  if (type.endsWith("[]")) {
    const base = type.slice(0, -2);
    if (!Array.isArray(value)) throw new Error(`Expected array for ${type}.`);
    return `new ${base}[]{${value.map((item) => javaLiteral(base, item)).join(", ")}}`;
  }
  throw new Error(`Unsupported Java scaffold type: ${type}`);
}

function quoteJava(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\t", "\\t")}"`;
}
