import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { LocalWorkspaceSettings } from "./types.js";

const defaults = (): LocalWorkspaceSettings => ({
  workspaceDirectory: config.defaultWorkspace,
  editor: "VS_CODE",
  editorPath: "",
  javaRuntimePath: "",
  javaCompilerPath: "",
  pythonPath: "",
  nodePath: "",
  goPath: "",
});

function nonBlank(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export class SettingsStore {
  constructor(private readonly settingsPath = config.settingsPath) {}

  get(): LocalWorkspaceSettings {
    if (!fs.existsSync(this.settingsPath)) return defaults();
    try {
      const properties = new Map<string, string>();
      for (const line of fs.readFileSync(this.settingsPath, "utf8").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const separator = trimmed.indexOf("=");
        properties.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
      }
      return this.normalize({
        workspaceDirectory: properties.get("workspaceDirectory"),
        editor: properties.get("editor"),
        editorPath: properties.get("editorPath"),
        javaRuntimePath: properties.get("javaRuntimePath"),
        javaCompilerPath: properties.get("javaCompilerPath"),
        pythonPath: properties.get("pythonPath"),
        nodePath: properties.get("nodePath"),
        goPath: properties.get("goPath"),
      });
    } catch {
      return defaults();
    }
  }

  save(input: Partial<LocalWorkspaceSettings>): LocalWorkspaceSettings {
    const current = this.get();
    const settings = this.normalize({ ...current, ...input });
    fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    const lines = [
      "# JURO local workspace settings",
      `workspaceDirectory=${settings.workspaceDirectory}`,
      `editor=${settings.editor}`,
      `editorPath=${settings.editorPath}`,
      `javaRuntimePath=${settings.javaRuntimePath}`,
      `javaCompilerPath=${settings.javaCompilerPath}`,
      `pythonPath=${settings.pythonPath}`,
      `nodePath=${settings.nodePath}`,
      `goPath=${settings.goPath}`,
      "",
    ];
    fs.writeFileSync(this.settingsPath, lines.join("\n"), "utf8");
    return settings;
  }

  private normalize(value: Record<string, unknown>): LocalWorkspaceSettings {
    const fallback = defaults();
    const editor = nonBlank(value.editor, fallback.editor).toUpperCase() as LocalWorkspaceSettings["editor"];
    if (editor !== "VS_CODE" && editor !== "NVIM") throw new Error("editor must be VS_CODE or NVIM.");
    const paths = ["editorPath", "javaRuntimePath", "javaCompilerPath", "pythonPath", "nodePath", "goPath"] as const;
    for (const key of paths) {
      const candidate = value[key];
      if (candidate !== undefined && typeof candidate !== "string") throw new Error(`${key} must be a string.`);
      if (typeof candidate === "string" && /[\r\n]/.test(candidate)) throw new Error(`${key} cannot contain line breaks.`);
    }
    return {
      workspaceDirectory: nonBlank(value.workspaceDirectory, fallback.workspaceDirectory),
      editor,
      editorPath: nonBlank(value.editorPath, fallback.editorPath),
      javaRuntimePath: nonBlank(value.javaRuntimePath, fallback.javaRuntimePath),
      javaCompilerPath: nonBlank(value.javaCompilerPath, fallback.javaCompilerPath),
      pythonPath: nonBlank(value.pythonPath, fallback.pythonPath),
      nodePath: nonBlank(value.nodePath, fallback.nodePath),
      goPath: nonBlank(value.goPath, fallback.goPath),
    };
  }
}
