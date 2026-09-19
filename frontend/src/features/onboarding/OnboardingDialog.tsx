import { useEffect, useState } from "react";
import { Check, CircleAlert, Code2, Play, X } from "lucide-react";
import { getLocalToolingStatus } from "../../api";
import type { LocalToolingStatus } from "../../types";

type Props = {
  onClose: () => void;
};

const TOOLING_KEYS: Array<keyof Pick<LocalToolingStatus, "javaCompiler" | "python" | "node" | "go">> = [
  "javaCompiler",
  "python",
  "node",
  "go",
];

const TOOL_LABELS: Record<(typeof TOOLING_KEYS)[number], string> = {
  javaCompiler: "Java",
  python: "Python",
  node: "Node.js",
  go: "Go",
};

export function OnboardingDialog({ onClose }: Props) {
  const [tooling, setTooling] = useState<LocalToolingStatus | null>(null);

  useEffect(() => {
    let active = true;
    getLocalToolingStatus()
      .then((status) => {
        if (active) setTooling(status);
      })
      .catch(() => {
        if (active) setTooling(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="onboarding-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section aria-label="Welcome to JURO" aria-modal="true" className="onboarding-dialog" role="dialog">
        <header className="onboarding-dialog__header">
          <div>
            <p className="eyebrow">Welcome to JURO</p>
            <h2>A simple loop for getting better at problems.</h2>
            <p>Pick one problem, work it locally, then come back and prove what you know.</p>
          </div>
          <button aria-label="Close welcome dialog" className="icon-button" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.35} />
          </button>
        </header>

        <div className="onboarding-dialog__body">
          <ol className="onboarding-steps">
            <li>
              <span className="onboarding-step__icon"><Code2 size={17} /></span>
              <div><strong>Choose a problem</strong><span>Start from Today’s queue or click any problem in the catalog.</span></div>
            </li>
            <li>
              <span className="onboarding-step__icon"><Play size={17} /></span>
              <div><strong>Code and test</strong><span>JURO creates a local workspace, opens your editor, and runs the test cases.</span></div>
            </li>
            <li>
              <span className="onboarding-step__icon"><Check size={17} /></span>
              <div><strong>Review what you know</strong><span>Grade the coding attempt, explain the idea to Claude, and get your next review date.</span></div>
            </li>
          </ol>

          <section className="onboarding-tooling" aria-label="Local tooling status">
            <div className="onboarding-tooling__header">
              <div><strong>Local tools</strong><span>JURO checks these before it runs code.</span></div>
              <span className="onboarding-tooling__path">{tooling?.workspaceDirectory ?? "Workspace not checked yet"}</span>
            </div>
            <div className="onboarding-tooling__grid">
              {TOOLING_KEYS.map((key) => {
                const status = tooling?.[key];
                return (
                  <span className={`onboarding-tool${status?.available ? " onboarding-tool--ready" : ""}`} key={key}>
                    {status?.available ? <Check size={14} /> : <CircleAlert size={14} />}
                    {TOOL_LABELS[key]}
                  </span>
                );
              })}
            </div>
            {tooling && !TOOLING_KEYS.every((key) => tooling[key].available) ? (
              <p className="onboarding-tooling__hint">Missing tools do not block JURO. They only disable problems in that language.</p>
            ) : null}
          </section>
        </div>

        <footer className="onboarding-dialog__footer">
          <span>Need help later? Open the <strong>?</strong> button in the sidebar.</span>
          <button className="button button--primary" onClick={onClose} type="button">Start practicing</button>
        </footer>
      </section>
    </div>
  );
}
