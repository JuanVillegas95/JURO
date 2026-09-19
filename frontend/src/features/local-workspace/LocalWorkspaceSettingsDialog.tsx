import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Upload, X } from "lucide-react";
import { FormSelect } from "../../components/ui/FormSelect";
import { ErrorMessage } from "../../components/ErrorMessage";
import { downloadLocalBackup, getLocalMcpConfig, getLocalMcpStatus, getLocalSettings, getLocalToolingStatus, restoreLocalBackup, saveLocalSettings } from "../../api";
import type { LocalEditorPreference, LocalToolingStatus, LocalWorkspaceSettings, McpConfigResponse, McpStatus } from "../../types";

type Props = {
  onClose: () => void;
  onSaved: (settings: LocalWorkspaceSettings) => void;
  onRestored?: () => void;
};

const editorOptions = [
  { label: "VS Code", value: "VS_CODE" },
  { label: "Neovim", value: "NVIM" },
] as const;

const defaults: LocalWorkspaceSettings = {
  workspaceDirectory: "",
  editor: "VS_CODE",
  editorPath: "",
  javaRuntimePath: "",
  javaCompilerPath: "",
  pythonPath: "",
  nodePath: "",
  goPath: "",
};

export function LocalWorkspaceSettingsDialog({ onClose, onSaved, onRestored }: Props) {
  const [settings, setSettings] = useState(defaults);
  const [tooling, setTooling] = useState<LocalToolingStatus | null>(null);
  const [mcpConfig, setMcpConfig] = useState<McpConfigResponse | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [toolingMessage, setToolingMessage] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getLocalSettings(), getLocalToolingStatus(), getLocalMcpConfig(), getLocalMcpStatus()])
      .then(([loaded, loadedTooling, loadedMcpConfig, loadedMcpStatus]) => {
        if (!active) return;
        setSettings({ ...defaults, ...loaded });
        setTooling(loadedTooling);
        setMcpConfig(loadedMcpConfig);
        setMcpStatus(loadedMcpStatus);
      })
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Unable to load settings."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveLocalSettings(settings);
      onSaved(saved);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function copyMcpConfig() {
    if (!mcpConfig) return;
    try {
      await navigator.clipboard.writeText(mcpConfig.configJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the MCP configuration. Select and copy it manually.");
    }
  }

  async function checkTooling() {
    setSaving(true);
    setError(null);
    setToolingMessage(null);
    try {
      const saved = await saveLocalSettings(settings);
      const refreshedTooling = await getLocalToolingStatus();
      setSettings(saved);
      setTooling(refreshedTooling);
      onSaved(saved);
      setToolingMessage("Paths checked. Blank fields use automatic PATH detection.");
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Unable to check local tool paths.");
    } finally {
      setSaving(false);
    }
  }

  async function exportBackup() {
    setBackupBusy(true);
    setBackupError(null);
    setBackupMessage(null);
    try {
      const { blob, filename } = await downloadLocalBackup();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBackupMessage(`Backup downloaded: ${filename}`);
    } catch (backupLoadError) {
      setBackupError(backupLoadError instanceof Error ? backupLoadError.message : "Unable to export the JURO database.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    if (!window.confirm("Restore this backup? JURO will create a safety copy of the current database before replacing it.")) {
      if (backupInputRef.current) backupInputRef.current.value = "";
      return;
    }
    setBackupBusy(true);
    setBackupError(null);
    setBackupMessage(null);
    try {
      const restored = await restoreLocalBackup(file);
      setBackupMessage(`Restored ${restored.summary.problems} problem${restored.summary.problems === 1 ? "" : "s"}. Safety copy: ${restored.safetyBackupFile}`);
      onRestored?.();
    } catch (restoreError) {
      setBackupError(restoreError instanceof Error ? restoreError.message : "Unable to restore the JURO database.");
    } finally {
      setBackupBusy(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  if (loading) {
    return <div className="settings-dialog-backdrop"><section className="settings-dialog" role="dialog"><div className="empty-state">Loading settings…</div></section></div>;
  }

  return (
    <div className="settings-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-label="Local workspace settings" aria-modal="true" className="settings-dialog" role="dialog">
        <header className="settings-dialog__header">
          <div><h2>Settings</h2><p>Workspace &amp; MCP</p></div>
          <button aria-label="Close settings" className="icon-button" onClick={onClose} type="button"><X size={17} /></button>
        </header>
        <div className="settings-dialog__body">
          {error ? <ErrorMessage className="error-banner" error={error} /> : null}
          <label className="settings-field"><span>Workspace directory</span><input value={settings.workspaceDirectory} onChange={(event) => setSettings((current) => ({ ...current, workspaceDirectory: event.target.value }))} /><small>Generated problem workspaces are stored here.</small></label>
          <label className="settings-field"><span>Preferred editor</span><FormSelect<LocalEditorPreference> ariaLabel="Preferred code editor" options={editorOptions} value={settings.editor} onValueChange={(editor) => setSettings((current) => ({ ...current, editor }))} /></label>
          <section className="settings-section settings-tool-paths" aria-label="Local executable paths">
            <div className="settings-section__header"><div><h3>Executable paths</h3><p>Leave blank to use automatic PATH detection.</p></div></div>
            <div className="settings-path-grid">
              <ToolPathField label={`${settings.editor === "VS_CODE" ? "VS Code" : "Neovim"} executable`} placeholder={settings.editor === "VS_CODE" ? "code or /path/to/code" : "nvim or /path/to/nvim"} value={settings.editorPath} onChange={(editorPath) => setSettings((current) => ({ ...current, editorPath }))} />
              <ToolPathField label="Java runtime (java)" placeholder="java or /path/to/java" value={settings.javaRuntimePath} onChange={(javaRuntimePath) => setSettings((current) => ({ ...current, javaRuntimePath }))} />
              <ToolPathField label="Java compiler (javac)" placeholder="javac or /path/to/javac" value={settings.javaCompilerPath} onChange={(javaCompilerPath) => setSettings((current) => ({ ...current, javaCompilerPath }))} />
              <ToolPathField label="Python" placeholder="python3 or /path/to/python3" value={settings.pythonPath} onChange={(pythonPath) => setSettings((current) => ({ ...current, pythonPath }))} />
              <ToolPathField label="Node.js" placeholder="node or /path/to/node" value={settings.nodePath} onChange={(nodePath) => setSettings((current) => ({ ...current, nodePath }))} />
              <ToolPathField label="Go" placeholder="go or /path/to/go" value={settings.goPath} onChange={(goPath) => setSettings((current) => ({ ...current, goPath }))} />
            </div>
            <div className="settings-path-actions"><button className="button button--ghost button--sm" disabled={saving} onClick={() => void checkTooling()} type="button">Check paths</button>{toolingMessage ? <small>{toolingMessage}</small> : null}</div>
          </section>
          <section className="settings-section" aria-label="MCP connection settings">
            <div className="settings-section__header"><div><h3>Claude / MCP</h3><p>Local MCP server.</p></div><span className="status-pill status-pill--success">{mcpStatus?.configured ? "Configured" : "Unavailable"}</span></div>
            <p className="settings-section__note">Paste into Claude's MCP config.</p>
            <pre className="settings-code-block"><code>{mcpConfig?.configJson ?? "MCP configuration unavailable."}</code></pre>
            <button className="button button--ghost" disabled={!mcpConfig} onClick={() => void copyMcpConfig()} type="button">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
            <small>{mcpStatus?.configured ? "Ready." : "Unavailable."}</small>
          </section>
          {tooling ? <section className="settings-section" aria-label="Local tooling status"><div className="settings-section__header"><div><h3>Local tooling</h3></div></div><table className="settings-tooling-table"><thead><tr><th>Tool</th><th>Available</th><th>Notes</th></tr></thead><tbody><ToolingRow label="Java" available={tooling.javaRuntime.available && tooling.javaCompiler.available} notes={!tooling.javaRuntime.available ? tooling.javaRuntime.detail : !tooling.javaCompiler.available ? tooling.javaCompiler.detail : undefined} /><ToolingRow label="Python" available={tooling.python.available} notes={!tooling.python.available ? tooling.python.detail : undefined} /><ToolingRow label="Node.js" available={tooling.node.available} notes={!tooling.node.available ? tooling.node.detail : undefined} /><ToolingRow label="Go" available={tooling.go.available} notes={!tooling.go.available ? tooling.go.detail : undefined} /><ToolingRow label="Maven" available={tooling.maven.available} notes={tooling.maven.available ? "Optional" : tooling.maven.detail} /></tbody></table></section> : null}
          <section className="settings-section settings-backup" aria-label="Data backup"><div className="settings-section__header"><div><h3>Data backup</h3><p>Export or restore your local SQLite progress.</p></div></div><div className="settings-backup__actions"><button className="button button--ghost" disabled={backupBusy} onClick={() => void exportBackup()} type="button"><Download size={14} />{backupBusy ? "Working…" : "Export database"}</button><button className="button button--ghost" disabled={backupBusy} onClick={() => backupInputRef.current?.click()} type="button"><Upload size={14} />Import database</button><input ref={backupInputRef} accept=".sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3" className="visually-hidden" onChange={(event) => void importBackup(event.target.files?.[0])} type="file" /></div><small>Import creates a safety copy before replacing the current database.</small>{backupError ? <ErrorMessage className="settings-backup__error" error={backupError} /> : null}{backupMessage ? <p className="settings-backup__message">{backupMessage}</p> : null}</section>
        </div>
        <footer className="settings-dialog__footer"><button className="button button--ghost" onClick={onClose} type="button">Cancel</button><button className="button button--primary" disabled={saving} onClick={() => void save()} type="button">{saving ? "Saving…" : "Save settings"}</button></footer>
      </section>
    </div>
  );
}

function ToolingRow({ label, available, notes }: { label: string; available: boolean; notes?: string }) {
  return <tr><th scope="row">{label}</th><td><span className={`tooling-mark tooling-mark--${available ? "available" : "missing"}`} aria-label={available ? "Available" : "Unavailable"}>{available ? "✓" : "—"}</span></td><td>{notes ?? (available ? "Ready" : "Unavailable")}</td></tr>;
}

function ToolPathField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return <label className="settings-field"><span>{label}</span><input autoCapitalize="none" autoCorrect="off" placeholder={placeholder} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} /><small>Command name or absolute executable path.</small></label>;
}
