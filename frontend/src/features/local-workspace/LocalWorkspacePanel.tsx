import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CheckCircle2, ChevronDown, ExternalLink, Mic, Play, RefreshCw, Terminal, X, XCircle } from "lucide-react";
import type {
  CodingSessionStage,
  KnowledgeEvaluationResult,
  LocalProblemCaseResult,
  LocalProblemRunResult,
  LocalProblemWorkspace,
  ReviewState,
} from "../../types";

type LocalWorkspacePanelProps = {
  activeWorkspace: LocalProblemWorkspace | null;
  isBusy: boolean;
  lastRunResult: LocalProblemRunResult | null;
  lastKnowledgeResult: KnowledgeEvaluationResult | null;
  onClear: () => void;
  onFinishSession: () => void;
  onKnowledgeCheck: () => void;
  onOpenEditor: () => void;
  onGradeCoding: (passed: boolean) => Promise<ReviewState>;
  onRunTests: () => void;
  codingReview: ReviewState | null;
};

export function LocalWorkspacePanel({
  activeWorkspace,
  isBusy,
  lastKnowledgeResult,
  lastRunResult,
  onClear,
  onFinishSession,
  onGradeCoding,
  onKnowledgeCheck,
  onOpenEditor,
  onRunTests,
  codingReview,
}: LocalWorkspacePanelProps) {
  const [expandedCases, setExpandedCases] = useState<Set<number>>(() => new Set());
  const [isGradingCoding, setIsGradingCoding] = useState(false);
  const [codingGradeMessage, setCodingGradeMessage] = useState<string | null>(null);

  if (!activeWorkspace || activeWorkspace.status === "NOT_OPEN" || activeWorkspace.status === "CLOSED") {
    return null;
  }

  function toggleCase(index: number) {
    setExpandedCases((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const result = lastRunResult;
  const status = result?.status ?? activeWorkspace.status ?? "Not run yet";
  const testsPassed = result?.status === "PASSED" && result.caseResults.length > 0 && result.caseResults.every((item) => item.passed);
  const workspaceMessage = activeWorkspace.message?.trim();
  const sessionStage: CodingSessionStage = codingReview
    ? "SCHEDULED"
    : result
      ? "TESTED"
      : activeWorkspace.opened || activeWorkspace.status === "OPEN"
        ? "EDITOR_OPEN"
        : "STARTED";
  const sessionStepIndex = sessionStage === "SCHEDULED" ? 4 : sessionStage === "TESTED" ? 3 : sessionStage === "EDITOR_OPEN" ? 2 : 1;
  const sessionSteps: Array<{ label: string; stage: CodingSessionStage }> = [
    { label: "Start", stage: "STARTED" },
    { label: "Open editor", stage: "EDITOR_OPEN" },
    { label: "Run tests", stage: "TESTED" },
    { label: "Grade yourself", stage: "GRADED" },
    { label: "Next review", stage: "SCHEDULED" },
  ];
  const canRunTests = Boolean(result) || activeWorkspace.opened || activeWorkspace.status === "OPEN";

  if (typeof document === "undefined") {
    return null;
  }

  async function gradeCoding(passed: boolean) {
    setIsGradingCoding(true);
    setCodingGradeMessage(null);
    try {
      const review = await onGradeCoding(passed);
      setCodingGradeMessage(
        passed
          ? `Coding marked passed. Next coding review is scheduled in ${review.intervalDays} day${review.intervalDays === 1 ? "" : "s"}.`
          : `Coding marked for review. It will be due again in ${review.intervalDays} day${review.intervalDays === 1 ? "" : "s"}.`,
      );
    } catch (gradeError) {
      setCodingGradeMessage(gradeError instanceof Error ? gradeError.message : "Unable to update the coding review schedule.");
    } finally {
      setIsGradingCoding(false);
    }
  }

  return createPortal(
    <div
      className="local-workspace-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClear();
        }
      }}
    >
      <section
        aria-label="Current local problem workspace"
        aria-modal="true"
        className="local-workspace-panel"
        role="dialog"
      >
        <div className="local-workspace-panel__summary">
          <div className="local-workspace-panel__copy">
            <span className="section-kicker">Current Problem</span>
            <h2>{activeWorkspace?.title ?? result?.title}</h2>
            <code>{activeWorkspace?.scaffoldPath ?? result?.scaffoldPath}</code>
          </div>
          <div className="local-workspace-panel__actions">
            <span className={`local-run-status local-run-status--${status.toString().toLowerCase().replace("_", "-")}`}>
              {status}
            </span>
            {lastKnowledgeResult ? (
              <span className={`local-run-status local-run-status--${lastKnowledgeResult.status.toLowerCase().replace("_", "-")}`}>
                Explain {lastKnowledgeResult.score}
              </span>
            ) : null}
            <button className="button button--ghost button--sm" disabled={isBusy || Boolean(codingReview)} onClick={onOpenEditor} type="button">
              <ExternalLink size={14} strokeWidth={2.25} />
              {sessionStage === "STARTED" ? "2. Open editor" : "Reopen editor"}
            </button>
            <button className="button button--ghost button--sm" disabled={isBusy} onClick={onKnowledgeCheck} type="button">
              <Mic size={14} strokeWidth={2.25} />
              Explain
            </button>
            <button className="button button--primary button--sm" disabled={isBusy || !canRunTests || Boolean(codingReview)} onClick={onRunTests} type="button">
              {isBusy ? <RefreshCw size={14} strokeWidth={2.25} /> : <Play size={14} strokeWidth={2.25} />}
              {result ? "Run tests again" : "3. Run tests"}
            </button>
            {codingReview ? (
              <button className="button button--primary button--sm" disabled={isBusy} onClick={onFinishSession} type="button">
                <CheckCircle2 size={14} strokeWidth={2.25} />
                Finish session
              </button>
            ) : null}
            <button aria-label="Close current problem" className="icon-button" onClick={onClear} type="button">
              <X size={15} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <ol className="coding-session-steps" aria-label="Coding session progress">
          {sessionSteps.map((step, index) => (
            <li
              className={`coding-session-step${index < sessionStepIndex ? " coding-session-step--complete" : ""}${
                index === sessionStepIndex ? " coding-session-step--active" : ""
              }`}
              key={step.stage}
            >
              <span className="coding-session-step__marker">{index < sessionStepIndex ? "✓" : index + 1}</span>
              <span>{step.label}</span>
              {index < sessionSteps.length - 1 ? <ArrowRight className="coding-session-step__arrow" size={13} aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        {!result && sessionStage === "STARTED" ? (
          <p className="local-workspace-panel__hint">Open the editor first. The test and self-grading steps unlock after that.</p>
        ) : null}

        {activeWorkspace.status === "ERROR" && workspaceMessage ? (
          <p className="local-workspace-panel__message local-workspace-panel__message--error">{workspaceMessage}</p>
        ) : null}

        {activeWorkspace.opened && !activeWorkspace.closeDetectionAvailable ? (
          <p className="local-workspace-panel__hint">
            Editor close detection is not available for this launch method. Clear the current problem when you are done.
          </p>
        ) : null}

        {result ? (
          <div className="local-result-panel">
            {codingReview ? (
              <section className="review-scheduled-panel" aria-label="Next review scheduled">
                <div>
                  <strong>Next review scheduled</strong>
                  <span>
                    {codingGradeMessage ?? `Coding will be reviewed again in ${codingReview.intervalDays} day${codingReview.intervalDays === 1 ? "" : "s"}.`}
                  </span>
                  <small>Due {formatReviewDate(codingReview.dueAt)}</small>
                </div>
                <button className="button button--primary button--sm" disabled={isBusy} onClick={onFinishSession} type="button">
                  <CheckCircle2 size={14} />
                  Finish session
                </button>
              </section>
            ) : (
              <section className="review-grade-panel" aria-label="Grade coding review">
                <div>
                  <strong>4. Grade yourself</strong>
                  <span>
                    {testsPassed
                      ? "All local test cases passed. Mark this review passed only if the solution is yours and you understand it."
                      : "The run did not pass cleanly. Mark needs review unless you intentionally stopped early."}
                  </span>
                </div>
                <div className="review-grade-panel__actions">
                  <button
                    className="button button--ghost button--sm review-grade-button review-grade-button--fail"
                    disabled={isBusy || isGradingCoding}
                    onClick={() => void gradeCoding(false)}
                    type="button"
                  >
                    <XCircle size={14} />
                    Needs review
                  </button>
                  <button
                    className="button button--primary button--sm review-grade-button review-grade-button--pass"
                    disabled={isBusy || isGradingCoding}
                    onClick={() => void gradeCoding(true)}
                    type="button"
                  >
                    <CheckCircle2 size={14} />
                    Passed
                  </button>
                </div>
                {codingGradeMessage ? <p className="review-grade-panel__message">{codingGradeMessage}</p> : null}
              </section>
            )}
            {result.caseResults.length > 0 ? (
              <div className="result-cases">
                {result.caseResults.map((caseResult, index) => {
                  const expanded = expandedCases.has(index);
                  return (
                    <article className={`result-case${expanded ? " result-case--expanded" : ""}`} key={`${caseResult.label}-${index}`}>
                      <button
                        aria-expanded={expanded}
                        className="result-case__header"
                        onClick={() => toggleCase(index)}
                        type="button"
                      >
                        <span
                          className={`result-case__status${
                            caseResult.passed ? " result-case__status--passed" : " result-case__status--failed"
                          }`}
                        >
                          {caseResult.passed ? "✓" : "✕"}
                        </span>
                        <span className="result-case__label">{caseResult.label}</span>
                        <span className="result-case__runtime">{caseResult.runtimeMillis} ms</span>
                        <ChevronDown className="result-case__chevron" size={16} strokeWidth={2.2} />
                      </button>
                      {expanded ? <LocalCaseDetails caseResult={caseResult} /> : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="local-output-block">
                <Terminal size={18} strokeWidth={2.25} />
                <pre>{result.stderr || result.stdout || "No output returned."}</pre>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

function LocalCaseDetails({ caseResult }: { caseResult: LocalProblemCaseResult }) {
  return (
    <div className="result-case__details">
      <ResultBlock label="Input" value={caseResult.inputData} />
      <ResultBlock label="Expected Output" value={caseResult.expectedOutput} />
      <ResultBlock label="Actual Output" value={caseResult.actualOutput} />
      <section className="result-detail-block">
        <h3>Explanation</h3>
        <p>{caseResult.note || "No explanation returned."}</p>
      </section>
    </div>
  );
}

function ResultBlock({ label, value }: { label: string; value: string }) {
  return (
    <section className="result-detail-block">
      <h3>{label}</h3>
      <code className="case-inline-output">{value}</code>
    </section>
  );
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "not available";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
