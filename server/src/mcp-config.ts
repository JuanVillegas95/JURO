import path from "node:path";
import type { McpConfigResponse } from "./types.js";

function projectRoot(): string {
  return path.basename(process.cwd()) === "server" ? path.resolve(process.cwd(), "..") : process.cwd();
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function localMcpConfig(): McpConfigResponse {
  const root = projectRoot();
  const command = process.platform === "win32" ? "bash" : "/bin/zsh";
  const args = ["-lc", `cd ${shellQuote(root)} && ./scripts/start-mcp.sh`];
  const config = {
    mcpServers: {
      juro: { command, args },
    },
  };
  return {
    transport: "stdio",
    configured: true,
    command,
    args,
    config,
    configJson: JSON.stringify(config, null, 2),
    message: "Local MCP server ready.",
  };
}

export function localMcpStatus(): Pick<McpConfigResponse, "transport" | "configured" | "command" | "args" | "message"> & { available: boolean; serverScript: string } {
  const configuration = localMcpConfig();
  return {
    transport: configuration.transport,
    configured: configuration.configured,
    available: true,
    command: configuration.command,
    args: configuration.args,
    message: configuration.message,
    serverScript: path.join(projectRoot(), "scripts", "start-mcp.sh"),
  };
}
