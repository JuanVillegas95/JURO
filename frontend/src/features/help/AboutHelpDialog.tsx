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
          <div className="help-dialog__intro">
            <h2>About JURO</h2>
            <p>
              JURO is your personal coding problem bank — built for deliberate practice, not passive collection. Add
              problems, open them in your editor, run tests, explain your thinking, and let spaced repetition decide
              what to study next.
            </p>
          </div>
          <button aria-label="Close help" className="icon-button" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.35} />
          </button>
        </header>

        <div className="help-dialog__body">
          <HelpSection title="Why JURO Exists">
            <p>
              Most problem trackers just record what you've solved. JURO goes further: it helps you decide what to
              practice next, and holds you accountable to actually knowing it — both in code and in explanation.
            </p>
          </HelpSection>

          <HelpSection title="Two Ways to Prove You Know a Problem">
            <div className="help-track-grid">
              <article className="help-track-card">
                <strong>Code</strong>
                <p>Can you implement the solution from scratch and pass all test cases?</p>
              </article>
              <article className="help-track-card">
                <strong>Explain</strong>
                <p>
                  Can you articulate the algorithm, edge cases, time complexity, and tradeoffs clearly — without
                  looking at the code?
                </p>
              </article>
            </div>
          </HelpSection>

          <HelpSection title="How Coding Practice Works">
            <ul>
              <li>Pick a problem from your bank</li>
              <li>JURO scaffolds it locally and opens it in your preferred editor (VS Code, Neovim, etc.)</li>
              <li>Write your solution, come back to JURO, and run the test suite</li>
              <li>The result is graded and updates your coding review schedule</li>
            </ul>
          </HelpSection>

          <HelpSection title="How Explanation Practice Works">
            <ul>
              <li>Open the Knowledge Check for any problem</li>
              <li>Speak or type your explanation of the approach, edge cases, and complexity</li>
              <li>JURO can transcribe your speech using the browser's built-in recognition</li>
              <li>Your explanation is sent to the configured AI provider for evaluation</li>
              <li>You decide the final verdict — pass or needs more review</li>
            </ul>
          </HelpSection>

          <HelpSection title="Spaced Repetition">
            <p>
              JURO schedules your next review based on how well you did. Nail it — the interval grows. Struggle — it
              comes back sooner. Code and explanation have separate schedules, since writing code takes longer and
              explanation reviews can happen more often and anywhere.
            </p>
          </HelpSection>

          <HelpSection title="Settings">
            <ul>
              <li>Set your workspace folder — where JURO builds your local problem scaffold</li>
              <li>Choose your preferred editor and verify Java tooling is available</li>
              <li>Configure your AI evaluator: Ollama, Codex Adapter, or Anthropic Claude</li>
              <li>Enable browser speech recognition, with typed text as a fallback</li>
            </ul>
          </HelpSection>

          <HelpSection title="Problem Authoring">
            <p>
              You own your bank. Use New Problem and Edit Problem to write your own entries — complete with examples,
              runnable test cases, starter code, a reference solution, a solution video, and a knowledge rubric. The
              rubric is what the AI uses to evaluate whether your explanation truly reflects understanding.
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
