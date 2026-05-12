import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type AboutHelpDialogProps = {
  onClose: () => void;
};

export function AboutHelpDialog({ onClose }: AboutHelpDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="help-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section aria-label="About JURO" aria-modal="true" className="help-dialog" role="dialog">
        <header className="help-dialog__header">
          <div>
            <span className="section-kicker">Help</span>
            <h2>About JURO</h2>
            <p>
              JURO is a personal coding-problem bank for self-study. It helps you collect problems, launch them in
              your local editor, test your solutions, explain your reasoning, and review each problem again at the
              right time.
            </p>
          </div>
          <button aria-label="Close help" className="icon-button" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.35} />
          </button>
        </header>

        <div className="help-dialog__body">
          <HelpSection title="Why JURO Exists">
            <p>
              JURO was born from the need for a dedicated repository of coding problems for deliberate practice. It is
              more structured than a simple list: it helps decide what to study next, not just record what has already
              been solved.
            </p>
          </HelpSection>

          <HelpSection title="Two Ways To Prove You Know A Problem">
            <div className="help-track-grid">
              <article className="help-track-card">
                <strong>Code</strong>
                <p>Can you implement the solution and pass the required test cases?</p>
              </article>
              <article className="help-track-card">
                <strong>Explain</strong>
                <p>Can you clearly explain the algorithm, edge cases, correctness, and complexity?</p>
              </article>
            </div>
          </HelpSection>

          <HelpSection title="How Coding Practice Works">
            <ul>
              <li>Choose a problem from the Problem Bank.</li>
              <li>JURO creates a local scaffold and opens it in your preferred editor, such as VS Code or Neovim.</li>
              <li>Write the solution locally, return to JURO, and run the tests.</li>
              <li>Use the result to grade the coding review.</li>
            </ul>
          </HelpSection>

          <HelpSection title="How Explanation Practice Works">
            <ul>
              <li>Open the Knowledge Check for a problem.</li>
              <li>Record or type your explanation of the approach, edge cases, and complexity.</li>
              <li>JURO can transcribe with browser speech recognition, then send the text to the configured AI provider.</li>
              <li>The AI gives feedback, but you decide whether the explanation passed or needs review.</li>
            </ul>
          </HelpSection>

          <HelpSection title="Spaced Repetition">
            <p>
              JURO schedules future reviews based on performance. Passing increases the interval before the next
              review. Failing, or marking something as needing review, brings it back sooner.
            </p>
            <p>
              Coding and explanation have separate schedules because writing code takes more time, while explanation
              reviews are faster and can happen more often.
            </p>
          </HelpSection>

          <HelpSection title="Settings">
            <ul>
              <li>Choose the workspace folder where JURO rebuilds the current local problem scaffold.</li>
              <li>Select your preferred editor and check Java tooling status.</li>
              <li>Configure Ollama, Codex Adapter, or Anthropic Claude as the AI evaluator.</li>
              <li>Use browser speech recognition for transcription, with manual text as the fallback.</li>
            </ul>
          </HelpSection>

          <HelpSection title="Problem Authoring">
            <p>
              New Problem and Edit Problem let you maintain your own bank. Problems include examples, runnable test
              cases, starter code, a reference solution, a solution video, and a knowledge rubric. The rubric is what
              the AI uses to evaluate conceptual understanding.
            </p>
          </HelpSection>
        </div>
      </section>
    </div>
  );
}

function HelpSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="help-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
