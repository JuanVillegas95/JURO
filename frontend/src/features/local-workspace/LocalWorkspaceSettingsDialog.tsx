import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Download, RefreshCw, Upload, X } from "lucide-react";
import { FormSelect } from "../../components/ui/FormSelect";
import {
  exportProblemBank,
  getAiStatus,
  getLocalSettings,
  getLocalToolingStatus,
  importProblemBank,
  saveLocalSettings,
} from "../../api";
import type {
  AiProvider,
  LocalEditorPreference,
  LocalAiStatus,
  LocalToolingStatus,
  LocalWorkspaceSettings,
  ProblemBankExport,
  ReviewFrequency,
} from "../../types";

const editorOptions = [
  { label: "VS Code", value: "VS_CODE" },
] as const;

const transcriptionOptions = [
  { label: "Browser speech", value: "BROWSER" },
  { label: "Manual text", value: "MANUAL" },
  { label: "Whisper service", value: "WHISPER" },
] as const;

const aiProviderOptions = [
  { label: "Ollama", value: "OLLAMA" },
  { label: "Codex Adapter", value: "CODEX_ADAPTER" },
] as const;

const aiProviderDefaults = {
  OLLAMA: {
    baseUrl: "http://localhost:11434",
    model: "llama3.1",
  },
  CODEX_ADAPTER: {
    baseUrl: "http://127.0.0.1:11435/v1/",
    model: "gpt-5.4",
  },
} satisfies Record<AiProvider, { baseUrl: string; model: string }>;

const reviewFrequencyOptions = [
  { label: "Less often", value: "LESS_OFTEN" },
  { label: "Balanced", value: "BALANCED" },
  { label: "More often", value: "MORE_OFTEN" },
] as const;

const schedulingDefaults = {
  schedulerAlgorithm: "SM2",
  reviewIntensity: "BALANCED",
  codeReviewFrequency: "BALANCED",
  explanationReviewFrequency: "BALANCED",
  practiceFocus: "BALANCED",
  minimumIntervalDays: 1,
  maximumCodingIntervalDays: 180,
  maximumExplanationIntervalDays: 90,
} satisfies Pick<
  LocalWorkspaceSettings,
  | "schedulerAlgorithm"
  | "reviewIntensity"
  | "codeReviewFrequency"
  | "explanationReviewFrequency"
  | "practiceFocus"
  | "minimumIntervalDays"
  | "maximumCodingIntervalDays"
  | "maximumExplanationIntervalDays"
>;

type LocalWorkspaceSettingsDialogProps = {
  onClose: () => void;
  onProblemBankImported: () => void;
  onSaved: (settings: LocalWorkspaceSettings) => void;
};

export function LocalWorkspaceSettingsDialog({
  onClose,
  onProblemBankImported,
  onSaved,
}: LocalWorkspaceSettingsDialogProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState<LocalWorkspaceSettings>({
    workspaceDirectory: "",
    editor: "VS_CODE",
    customEditorCommand: "",
    aiProvider: "OLLAMA",
    aiBaseUrl: aiProviderDefaults.OLLAMA.baseUrl,
    aiModel: aiProviderDefaults.OLLAMA.model,
    ollamaBaseUrl: aiProviderDefaults.OLLAMA.baseUrl,
    ollamaModel: aiProviderDefaults.OLLAMA.model,
    transcriptionProvider: "BROWSER",
    ...schedulingDefaults,
  });
  const [aiProviderDrafts, setAiProviderDrafts] = useState<Record<AiProvider, { baseUrl: string; model: string }>>({
    OLLAMA: aiProviderDefaults.OLLAMA,
    CODEX_ADAPTER: aiProviderDefaults.CODEX_ADAPTER,
  });
  const [toolingStatus, setToolingStatus] = useState<LocalToolingStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<LocalAiStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [isExportingProblemBank, setIsExportingProblemBank] = useState(false);
  const [isImportingProblemBank, setIsImportingProblemBank] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const [loadedSettings, loadedTooling, loadedAi] = await Promise.all([
          getLocalSettings(),
          getLocalToolingStatus(),
          getAiStatus(),
        ]);
        if (active) {
          const normalizedSettings = withSettingsDefaults(loadedSettings);
          setSettings(normalizedSettings);
          setAiProviderDrafts(aiDraftsFromSettings(normalizedSettings));
          setToolingStatus(loadedTooling);
          setAiStatus(loadedAi);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load local workspace settings.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSave() {
    const validationError = schedulingValidationError(settings);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saved = await saveLocalSettings(settings);
      const refreshedTooling = await getLocalToolingStatus();
      const normalizedSaved = withSettingsDefaults(saved);
      setSettings(normalizedSaved);
      setToolingStatus(refreshedTooling);
      onSaved(normalizedSaved);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save local workspace settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestAi() {
    const validationError = schedulingValidationError(settings);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsTestingAi(true);
    setError(null);

    try {
      const saved = await saveLocalSettings(settings);
      setSettings(withSettingsDefaults(saved));
      setAiStatus(await getAiStatus());
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Unable to test AI evaluator connection.");
    } finally {
      setIsTestingAi(false);
    }
  }

  function resetSchedulingDefaults() {
    setSettings((current) => ({
      ...current,
      ...schedulingDefaults,
    }));
    setError(null);
  }

  async function handleExportProblemBank() {
    setIsExportingProblemBank(true);
    setTransferMessage(null);
    setError(null);

    try {
      const snapshot = await exportProblemBank();
      const datePart = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `juro-problem-bank-${datePart}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setTransferMessage(`Exported ${snapshot.problems.length} ${snapshot.problems.length === 1 ? "problem" : "problems"}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export problem bank.");
    } finally {
      setIsExportingProblemBank(false);
    }
  }

  async function handleImportProblemBank(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImportingProblemBank(true);
    setTransferMessage(null);
    setError(null);

    try {
      const parsed = JSON.parse(await file.text()) as ProblemBankExport;
      const result = await importProblemBank(parsed);
      onProblemBankImported();
      setTransferMessage(
        `Imported ${result.created + result.updated} problems, ${result.reviewStatesImported} review schedules, and ${result.submissionsImported} submissions.`,
      );
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Unable to import problem bank.";
      setError(message);
    } finally {
      setIsImportingProblemBank(false);
      event.target.value = "";
    }
  }

  function setNumericSetting(
    key: "minimumIntervalDays" | "maximumCodingIntervalDays" | "maximumExplanationIntervalDays",
    value: string,
  ) {
    const parsed = Number.parseInt(value, 10);
    setSettings((current) => ({
      ...current,
      [key]: Number.isNaN(parsed) ? 0 : parsed,
    }));
  }

  function setAiProvider(aiProvider: AiProvider) {
    const nextDrafts = {
      ...aiProviderDrafts,
      [settings.aiProvider]: {
        baseUrl: settings.aiBaseUrl,
        model: settings.aiModel,
      },
    };
    const nextProviderSettings = nextDrafts[aiProvider];
    setAiProviderDrafts(nextDrafts);
    setSettings((current) => ({
      ...current,
      aiProvider,
      aiBaseUrl: nextProviderSettings.baseUrl,
      aiModel: nextProviderSettings.model,
      ollamaBaseUrl: nextDrafts.OLLAMA.baseUrl,
      ollamaModel: nextDrafts.OLLAMA.model,
    }));
    setAiStatus(null);
  }

  function updateAiBaseUrl(aiBaseUrl: string) {
    setAiProviderDrafts((current) => ({
      ...current,
      [settings.aiProvider]: {
        ...current[settings.aiProvider],
        baseUrl: aiBaseUrl,
      },
    }));
    setSettings((current) => ({
      ...current,
      aiBaseUrl,
      ...(current.aiProvider === "OLLAMA" ? { ollamaBaseUrl: aiBaseUrl } : {}),
    }));
  }

  function updateAiModel(aiModel: string) {
    setAiProviderDrafts((current) => ({
      ...current,
      [settings.aiProvider]: {
        ...current[settings.aiProvider],
        model: aiModel,
      },
    }));
    setSettings((current) => ({
      ...current,
      aiModel,
      ...(current.aiProvider === "OLLAMA" ? { ollamaModel: aiModel } : {}),
    }));
  }

  return (
    <div
      className="settings-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section aria-label="Local workspace settings" aria-modal="true" className="settings-dialog" role="dialog">
        <header className="settings-dialog__header">
          <div>
            <h2>Settings</h2>
            <p>Local workspace</p>
          </div>
          <button aria-label="Close settings" className="icon-button" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.35} />
          </button>
        </header>

        <div className="settings-dialog__body">
          {isLoading ? <div className="empty-state">Loading settings…</div> : null}
          {error ? <div className="error-banner">{error}</div> : null}

          {!isLoading ? (
            <>
              <label className="settings-field">
                <span>Workspace directory</span>
                <input
                  placeholder="/Users/me/dev/juro-workspace"
                  value={settings.workspaceDirectory}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, workspaceDirectory: event.target.value }))
                  }
                />
                <small>JURO rebuilds one current problem workspace inside this directory.</small>
              </label>

              <label className="settings-field">
                <span>Preferred editor</span>
                <FormSelect<LocalEditorPreference>
                  ariaLabel="Preferred code editor"
                  onValueChange={() => setSettings((current) => ({ ...current, editor: "VS_CODE" }))}
                  options={editorOptions}
                  value={settings.editor}
                />
                <small>Only VS Code is enabled while JURO uses its dedicated editor window workflow.</small>
              </label>

              <section className="settings-section" aria-label="AI evaluation settings">
                <div className="settings-section__header">
                  <div>
                    <h3>AI Evaluation</h3>
                    <p>
                      Used for verbal knowledge checks. Choose Ollama for local models or Codex Adapter for an
                      OpenAI-compatible local Codex endpoint.
                    </p>
                  </div>
                  <button
                    className="button button--ghost button--sm"
                    disabled={isTestingAi}
                    onClick={handleTestAi}
                    type="button"
                  >
                    <RefreshCw size={14} />
                    Test
                  </button>
                </div>

                <label className="settings-field">
                  <span>AI provider</span>
                  <FormSelect<AiProvider>
                    ariaLabel="AI evaluation provider"
                    onValueChange={setAiProvider}
                    options={aiProviderOptions}
                    value={settings.aiProvider}
                  />
                  <small>
                    {settings.aiProvider === "CODEX_ADAPTER" ? (
                      <>
                        Codex Adapter expects an OpenAI-compatible URL, usually <code>http://127.0.0.1:11435/v1/</code>.
                      </>
                    ) : (
                      <>
                        Ollama usually listens on <code>http://localhost:11434</code>.
                      </>
                    )}
                  </small>
                </label>

                <label className="settings-field">
                  <span>{settings.aiProvider === "CODEX_ADAPTER" ? "Codex Adapter base URL" : "Ollama base URL"}</span>
                  <input
                    placeholder={aiProviderDefaults[settings.aiProvider].baseUrl}
                    value={settings.aiBaseUrl}
                    onChange={(event) => updateAiBaseUrl(event.target.value)}
                  />
                </label>

                <label className="settings-field">
                  <span>Model name</span>
                  <input
                    placeholder={aiProviderDefaults[settings.aiProvider].model}
                    value={settings.aiModel}
                    onChange={(event) => updateAiModel(event.target.value)}
                  />
                  <small>
                    {settings.aiProvider === "CODEX_ADAPTER"
                      ? "Example: gpt-5.4 or gpt-5-mini through the OCA API Adapter."
                      : "Example: llama3.1, qwen2.5, or another model installed in Ollama."}
                  </small>
                </label>

                <label className="settings-field">
                  <span>Transcription provider</span>
                  <FormSelect
                    ariaLabel="Transcription provider"
                    onValueChange={(transcriptionProvider) =>
                      setSettings((current) => ({ ...current, transcriptionProvider }))
                    }
                    options={transcriptionOptions}
                    value={settings.transcriptionProvider}
                  />
                  <small>The AI evaluator reads text. Browser speech recognition or manual input creates the transcript.</small>
                </label>

                {aiStatus ? (
                  <div className="tooling-status">
                    <ToolingRow
                      label={settings.aiProvider === "CODEX_ADAPTER" ? "Codex Adapter" : "Ollama"}
                      ok={aiStatus.available}
                      value={aiStatus.message}
                    />
                    <ToolingRow
                      label="Model"
                      ok={aiStatus.available && (aiStatus.models.length === 0 || aiStatus.models.includes(settings.aiModel))}
                      value={aiStatus.selectedModel}
                    />
                  </div>
                ) : null}
              </section>

              <section className="settings-section" aria-label="Spaced repetition settings">
                <div className="settings-section__header">
                  <div>
                    <h3>Spaced Repetition</h3>
                    <p>
                      JURO schedules reviews using a spaced repetition system inspired by Anki. Passing a review
                      increases the interval before the problem appears again. Marking a review as needing work brings
                      it back sooner.
                    </p>
                  </div>
                  <button className="button button--ghost button--sm" onClick={resetSchedulingDefaults} type="button">
                    Reset defaults
                  </button>
                </div>

                <div className="settings-copy-grid">
                  <section className="settings-copy-panel">
                    <h4>How JURO Decides What To Review</h4>
                    <p>
                      Each problem has two independent schedules: Code and Explain. When you pass, JURO increases the
                      interval before the next review. When you mark a review as needing work, JURO brings it back
                      sooner. Problems that are due, recently failed, or still new rise higher in the Problem Bank.
                    </p>
                  </section>
                  <section className="settings-copy-panel">
                    <h4>Recommended Scientific Default</h4>
                    <p>
                      The recommended default is a balanced SM-2 style schedule. This is inspired by spaced repetition
                      research and systems like Anki: review shortly after learning, then gradually increase the
                      interval after successful recall. The best schedule can vary by learner.
                    </p>
                  </section>
                </div>

                <section className="settings-copy-panel settings-copy-panel--compact">
                  <h4>Scheduling algorithm</h4>
                  <p>
                    JURO uses an SM-2 style scheduler inspired by the original SuperMemo and Anki approach. It increases
                    review intervals after successful recalls and shortens them after failures. Explanation reviews are
                    naturally shorter than coding reviews because explaining is faster than a full implementation. Tune
                    each track directly with the two frequency controls below.
                  </p>
                </section>

                <div className="settings-control-grid">
                  <label className="settings-field">
                    <span>Code review frequency</span>
                    <FormSelect<ReviewFrequency>
                      ariaLabel="Code review frequency"
                      onValueChange={(codeReviewFrequency) =>
                        setSettings((current) => ({ ...current, codeReviewFrequency }))
                      }
                      options={reviewFrequencyOptions}
                      value={settings.codeReviewFrequency}
                    />
                    <small>Use More often if you want to re-implement problems more frequently.</small>
                  </label>

                  <label className="settings-field">
                    <span>Explanation review frequency</span>
                    <FormSelect<ReviewFrequency>
                      ariaLabel="Explanation review frequency"
                      onValueChange={(explanationReviewFrequency) =>
                        setSettings((current) => ({ ...current, explanationReviewFrequency }))
                      }
                      options={reviewFrequencyOptions}
                      value={settings.explanationReviewFrequency}
                    />
                    <small>Use More often to strengthen conceptual recall through quick verbal reviews.</small>
                  </label>
                </div>

                <details className="settings-advanced">
                  <summary>Advanced intervals</summary>
                  <div className="settings-number-grid">
                    <label className="settings-field">
                      <span>Minimum interval</span>
                      <input
                        min={1}
                        type="number"
                        value={settings.minimumIntervalDays}
                        onChange={(event) => setNumericSetting("minimumIntervalDays", event.target.value)}
                      />
                      <small>Prevents reviews from appearing too aggressively.</small>
                    </label>
                    <label className="settings-field">
                      <span>Max coding interval</span>
                      <input
                        min={settings.minimumIntervalDays}
                        type="number"
                        value={settings.maximumCodingIntervalDays}
                        onChange={(event) => setNumericSetting("maximumCodingIntervalDays", event.target.value)}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Max explanation interval</span>
                      <input
                        min={settings.minimumIntervalDays}
                        type="number"
                        value={settings.maximumExplanationIntervalDays}
                        onChange={(event) => setNumericSetting("maximumExplanationIntervalDays", event.target.value)}
                      />
                    </label>
                  </div>
                </details>
              </section>

              <section className="settings-section" aria-label="Problem bank backup">
                <div className="settings-section__header">
                  <div>
                    <h3>Problem Bank Backup</h3>
                    <p>
                      Export or import problems with examples, test cases, review due dates, spaced repetition progress,
                      and submission history.
                    </p>
                  </div>
                </div>

                <div className="settings-actions-row">
                  <button
                    className="button button--ghost button--sm"
                    disabled={isExportingProblemBank || isImportingProblemBank}
                    onClick={handleExportProblemBank}
                    type="button"
                  >
                    <Download size={14} />
                    {isExportingProblemBank ? "Exporting..." : "Export bank"}
                  </button>
                  <button
                    className="button button--ghost button--sm"
                    disabled={isExportingProblemBank || isImportingProblemBank}
                    onClick={() => importInputRef.current?.click()}
                    type="button"
                  >
                    <Upload size={14} />
                    {isImportingProblemBank ? "Importing..." : "Import bank"}
                  </button>
                  <input
                    ref={importInputRef}
                    accept="application/json,.json"
                    className="settings-file-input"
                    onChange={handleImportProblemBank}
                    type="file"
                  />
                </div>

                {transferMessage ? <div className="settings-transfer-message">{transferMessage}</div> : null}
              </section>

              {toolingStatus ? (
                <section className="tooling-status" aria-label="Local tooling status">
                  <ToolingRow label="Workspace" ok={toolingStatus.workspaceWritable} value={toolingStatus.workspaceDirectory} />
                  <ToolingRow
                    label="Java"
                    ok={toolingStatus.javaRuntime.available}
                    value={toolingStatus.javaRuntime.version || toolingStatus.javaRuntime.detail}
                  />
                  <ToolingRow
                    label="javac"
                    ok={toolingStatus.javaCompiler.available}
                    value={toolingStatus.javaCompiler.version || toolingStatus.javaCompiler.detail}
                  />
                  <ToolingRow
                    label="Maven"
                    ok={toolingStatus.maven.available}
                    value={toolingStatus.maven.version || toolingStatus.maven.detail}
                  />
                </section>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="settings-dialog__footer">
          <button className="delete-confirmation__cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button button--primary button--sm" disabled={isSaving} onClick={handleSave} type="button">
            {isSaving ? "Saving…" : "Save settings"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function schedulingValidationError(settings: LocalWorkspaceSettings) {
  if (settings.minimumIntervalDays < 1) {
    return "Minimum review interval must be at least 1 day.";
  }

  if (settings.maximumCodingIntervalDays < settings.minimumIntervalDays) {
    return "Max coding interval must be greater than or equal to the minimum interval.";
  }

  if (settings.maximumExplanationIntervalDays < settings.minimumIntervalDays) {
    return "Max explanation interval must be greater than or equal to the minimum interval.";
  }

  return null;
}

function withSettingsDefaults(settings: LocalWorkspaceSettings): LocalWorkspaceSettings {
  const aiProvider = settings.aiProvider ?? "OLLAMA";
  const activeBaseUrl =
    settings.aiBaseUrl ??
    (aiProvider === "OLLAMA" ? settings.ollamaBaseUrl : undefined) ??
    aiProviderDefaults[aiProvider].baseUrl;
  const activeModel =
    settings.aiModel ??
    (aiProvider === "OLLAMA" ? settings.ollamaModel : undefined) ??
    aiProviderDefaults[aiProvider].model;
  return {
    ...settings,
    editor: "VS_CODE",
    customEditorCommand: "",
    aiProvider,
    aiBaseUrl: activeBaseUrl,
    aiModel: activeModel,
    ollamaBaseUrl:
      settings.ollamaBaseUrl ??
      (aiProvider === "OLLAMA" ? activeBaseUrl : undefined) ??
      aiProviderDefaults.OLLAMA.baseUrl,
    ollamaModel:
      settings.ollamaModel ??
      (aiProvider === "OLLAMA" ? activeModel : undefined) ??
      aiProviderDefaults.OLLAMA.model,
    schedulerAlgorithm: settings.schedulerAlgorithm ?? schedulingDefaults.schedulerAlgorithm,
    reviewIntensity: schedulingDefaults.reviewIntensity,
    codeReviewFrequency: settings.codeReviewFrequency ?? schedulingDefaults.codeReviewFrequency,
    explanationReviewFrequency: settings.explanationReviewFrequency ?? schedulingDefaults.explanationReviewFrequency,
    practiceFocus: schedulingDefaults.practiceFocus,
    minimumIntervalDays: settings.minimumIntervalDays ?? schedulingDefaults.minimumIntervalDays,
    maximumCodingIntervalDays: settings.maximumCodingIntervalDays ?? schedulingDefaults.maximumCodingIntervalDays,
    maximumExplanationIntervalDays:
      settings.maximumExplanationIntervalDays ?? schedulingDefaults.maximumExplanationIntervalDays,
  };
}

function aiDraftsFromSettings(settings: LocalWorkspaceSettings): Record<AiProvider, { baseUrl: string; model: string }> {
  return {
    OLLAMA: {
      baseUrl:
        settings.ollamaBaseUrl ??
        (settings.aiProvider === "OLLAMA" ? settings.aiBaseUrl : undefined) ??
        aiProviderDefaults.OLLAMA.baseUrl,
      model:
        settings.ollamaModel ??
        (settings.aiProvider === "OLLAMA" ? settings.aiModel : undefined) ??
        aiProviderDefaults.OLLAMA.model,
    },
    CODEX_ADAPTER: {
      baseUrl: settings.aiProvider === "CODEX_ADAPTER" ? settings.aiBaseUrl : aiProviderDefaults.CODEX_ADAPTER.baseUrl,
      model: settings.aiProvider === "CODEX_ADAPTER" ? settings.aiModel : aiProviderDefaults.CODEX_ADAPTER.model,
    },
  };
}

function ToolingRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="tooling-status__row">
      <span className={`tooling-status__mark${ok ? " tooling-status__mark--ok" : ""}`}>{ok ? "✓" : "!"}</span>
      <strong>{label}</strong>
      <span>{value || "Not available"}</span>
    </div>
  );
}
