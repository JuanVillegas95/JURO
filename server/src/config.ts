import os from "node:os";
import path from "node:path";

function env(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function expandPath(value: string): string {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

const projectRoot = path.basename(process.cwd()) === "server" ? path.resolve(process.cwd(), "..") : process.cwd();

function resolvePath(value: string): string {
  const expanded = expandPath(value);
  return path.isAbsolute(expanded) ? expanded : path.resolve(projectRoot, expanded);
}

function boundedTimeout(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 20_000;
  return Math.min(60_000, Math.max(250, parsed));
}

export const config = {
  port: Number.parseInt(env("PORT", "3000"), 10),
  host: env("HOST", "127.0.0.1"),
  databasePath: resolvePath(env("JURO_DATABASE_PATH", path.join(projectRoot, ".data", "juro.sqlite"))),
  settingsPath: resolvePath(env("JURO_SETTINGS_PATH", path.join(os.homedir(), ".juro", "settings.properties"))),
  frontendDist: resolvePath(env("JURO_FRONTEND_DIST", path.join(projectRoot, "frontend", "dist"))),
  defaultWorkspace: expandPath(env("JURO_WORKSPACE_DIRECTORY", path.join(os.homedir(), "juro-workspace"))),
  runTimeoutMs: boundedTimeout(env("JURO_RUN_TIMEOUT_MS", "20000")),
};
