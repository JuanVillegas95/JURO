import { spawn } from "node:child_process";

export interface ClaudeLaunchResult {
  launched: boolean;
  copied: boolean;
  prompt: string;
  message: string;
}

export function knowledgeCheckPrompt(problemId: string, title: string, sessionId: string): string {
  return [
    "You are JURO's knowledge coach.",
    `We are going to explain the problem \"${title}\" (problemId: ${problemId}).`,
    "Use the JURO MCP server now:",
    `1. Call get_current_problem. If needed, call start_knowledge_check with problemId \"${problemId}\" and sessionId \"${sessionId}\".`,
    "2. Say: Okay, we are going to explain this problem. I will ask a few questions and then rate your explanation.",
    "3. Ask the learner to explain the algorithm, correctness invariant, edge cases, and time/space complexity. Ask follow-up questions when needed.",
    "4. Do not reveal the reference solution or hidden tests.",
    "5. When finished, call submit_knowledge_check with a score from 0 to 100, strengths, missing concepts, and status PASSED, NEEDS_REVIEW, or FAILED.",
  ].join("\n");
}

export async function launchClaude(prompt: string): Promise<ClaudeLaunchResult> {
  const launched = await launchClient();
  const copied = await copyToClipboard(prompt);
  const message = launched
    ? copied
      ? "Claude opened. The knowledge-check prompt is copied; start a voice conversation."
      : "Claude opened, but the prompt could not be copied. Use the manual knowledge check instead."
    : "Claude could not be opened. Use the manual knowledge check instead.";
  return { launched, copied, prompt, message };
}

async function launchClient(): Promise<boolean> {
  if (process.platform === "darwin") return runCommand("open", ["-a", "Claude"]);
  if (process.platform === "win32") return runCommand("cmd", ["/c", "start", "", "https://claude.ai/new"]);
  return runCommand("xdg-open", ["https://claude.ai/new"]);
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (process.platform === "darwin") return runCommand("pbcopy", [], value);
  if (process.platform === "win32") return runCommand("clip", [], value);
  if (await runCommand("sh", ["-c", "command -v xclip >/dev/null 2>&1"])) return runCommand("xclip", ["-selection", "clipboard"], value);
  if (await runCommand("sh", ["-c", "command -v xsel >/dev/null 2>&1"])) return runCommand("xsel", ["--clipboard", "--input"], value);
  return false;
}

function runCommand(command: string, args: string[], input?: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, args, { stdio: [input === undefined ? "ignore" : "pipe", "ignore", "ignore"] });
    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      resolve(success);
    };
    child.once("error", () => finish(false));
    child.once("close", (code) => finish(code === 0));
    if (input !== undefined && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}
