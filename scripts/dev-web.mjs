import { spawn } from "node:child_process";

const processes = [
  spawn("npm", ["--prefix", "server", "run", "dev"], { stdio: "inherit", env: process.env }),
  spawn("npm", ["--prefix", "frontend", "run", "dev"], { stdio: "inherit", env: process.env }),
];

function stop() {
  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.once("SIGINT", () => { stop(); process.exit(0); });
process.once("SIGTERM", () => { stop(); process.exit(0); });
for (const child of processes) child.once("exit", (code) => { if (code && code !== 0) { stop(); process.exitCode = code; } });
