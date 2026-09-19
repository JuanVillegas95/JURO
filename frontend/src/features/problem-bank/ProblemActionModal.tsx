import { useState } from "react";
import { AlertTriangle, ArrowRight, ExternalLink, FolderCode, Mic, RefreshCw, X } from "lucide-react";
import type { CatalogProblem } from "./catalog";
import { displayDifficulty, displayLanguage, reviewDueLabel, reviewLabel } from "./catalog";
import { ProgressHistoryPanel } from "./ProgressHistoryPanel";

type Props = {
  problem: CatalogProblem;
  busy: boolean;
  onClose: () => void;
  onOpenEditor: () => void;
  onRegenerate: () => void;
  onExplain: () => void;
  onSolution: () => void;
};

export function ProblemActionModal({ problem, busy, onClose, onOpenEditor, onRegenerate, onExplain, onSolution }: Props) {
  const [isRegenerateConfirming, setIsRegenerateConfirming] = useState(false);

  return (
    <div
      className="problem-action-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="problem-action-modal" role="dialog" aria-modal="true" aria-label={`${problem.title} actions`}>
        <header className="problem-action-modal__header">
          <div>
            <span className="section-kicker">Current Problem</span>
            <h2>{problem.displayTitle}</h2>
            <p>{problem.summary}</p>
          </div>
          <button className="icon-button" aria-label="Close problem" onClick={onClose} type="button">
            <X size={17} />
          </button>
        </header>
        <div className="problem-action-modal__meta">
          <span className={`tag tag--language tag--${problem.type.toLowerCase()}`}>
            {displayLanguage(problem.type)}
          </span>
          <span className={`tag tag--difficulty tag--${problem.difficulty.toLowerCase()}`}>
            {displayDifficulty(problem.difficulty)}
          </span>
          <span className="problem-action-modal__current">Current problem</span>
        </div>
        <div className="problem-action-modal__reviews">
          <span>Code: {reviewLabel(problem.codingReview)} · {reviewDueLabel(problem.codingReview)}</span>
          <span>Explain: {reviewLabel(problem.explanationReview)} · {reviewDueLabel(problem.explanationReview)}</span>
        </div>
        <div className="problem-action-modal__flow" aria-label="Coding session steps">
          <span className="problem-action-modal__flow-step problem-action-modal__flow-step--active">1 Start</span>
          <ArrowRight size={13} aria-hidden="true" />
          <span className="problem-action-modal__flow-step">2 Editor</span>
          <ArrowRight size={13} aria-hidden="true" />
          <span className="problem-action-modal__flow-step">3 Tests</span>
          <ArrowRight size={13} aria-hidden="true" />
          <span className="problem-action-modal__flow-step">4 Grade</span>
          <ArrowRight size={13} aria-hidden="true" />
          <span className="problem-action-modal__flow-step">5 Next review</span>
        </div>
        <div className="problem-action-modal__actions">
          <button className="button button--primary" disabled={busy} onClick={onOpenEditor} type="button">
            <FolderCode size={15} />
            Start session · Open editor
          </button>
          <button className="button button--ghost" disabled={busy} onClick={onExplain} type="button">
            <Mic size={15} />
            Explain with Claude
          </button>
          <button
            className="button button--ghost"
            disabled={busy}
            onClick={() => setIsRegenerateConfirming(true)}
            type="button"
          >
            <RefreshCw size={15} />
            Regenerate
          </button>
          {problem.solutionVideoUrl ? (
            <button className="button button--ghost" disabled={busy} onClick={onSolution} type="button">
              <ExternalLink size={15} />
              Solution
            </button>
          ) : null}
        </div>

        <ProgressHistoryPanel problemId={problem.id} />

        {isRegenerateConfirming ? (
          <div className="problem-action-modal__confirmation" role="alertdialog" aria-label="Confirm regeneration">
            <div className="problem-action-modal__confirmation-icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </div>
            <div className="problem-action-modal__confirmation-copy">
              <strong>Regenerate this problem?</strong>
              <p>Regenerating will recreate the local scaffold and may overwrite generated files in the workspace.</p>
            </div>
            <div className="problem-action-modal__confirmation-actions">
              <button
                className="button button--ghost"
                disabled={busy}
                onClick={() => setIsRegenerateConfirming(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="button button--danger" disabled={busy} onClick={onRegenerate} type="button">
                Regenerate
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
