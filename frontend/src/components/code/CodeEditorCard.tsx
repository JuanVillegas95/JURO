import Editor from '@monaco-editor/react';
import type { ReactNode } from 'react';
import { ChevronDown, Copy, Expand, Settings } from 'lucide-react';
import { useAppTheme } from '../../app/theme';
import type { ProblemType } from '../../types';
import { CodeFontSizeControls } from './CodeFontSizeControls';
import { configureMonacoTheme, editorLanguageFor } from './codeUtils';
import { useCodeEditorFontSize } from './useCodeEditorFontSize';

export type CodeEditorCardProps = {
  code: string;
  embedded?: boolean;
  language: ProblemType;
  onChange: (value: string) => void;
  title: string;
  titleIcon: ReactNode;
};

export function CodeEditorCard({ code, embedded = false, language, onChange, title, titleIcon }: CodeEditorCardProps) {
  const { theme } = useAppTheme();
  const { fontSize, lineHeight } = useCodeEditorFontSize();

  return (
    <section
      className={`${embedded ? "rounded-none border-0" : "overflow-hidden rounded-xl border border-[var(--border)]"} bg-[var(--bg-card)] text-[var(--text-primary)]`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        {!embedded ? (
          <span className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-[12px] font-bold text-[var(--text-primary)]">
            {titleIcon}
            {title}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-[12px] font-bold text-[var(--text-primary)]">
            {title}
          </span>
        )}
        <div className="flex items-center gap-1">
          <CodeFontSizeControls />
          {[Copy, Expand, Settings, ChevronDown].map((Icon, index) => (
            <button
              aria-label={`Code editor control ${index + 1}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/35"
              key={`${Icon.displayName ?? Icon.name}-${index}`}
              onClick={() => {
                if (Icon === Copy) {
                  void navigator.clipboard?.writeText(code);
                }
              }}
              type="button"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>
      <div className={embedded ? "min-h-[170px]" : "min-h-[190px]"} style={{ backgroundColor: "var(--bg-card)" }}>
        <Editor
          beforeMount={configureMonacoTheme}
          height={embedded ? "170px" : "190px"}
          language={editorLanguageFor(language)}
          options={{
            automaticLayout: true,
            bracketPairColorization: { enabled: true },
            cursorBlinking: "smooth",
            fontFamily: "Chakra Petch, SFMono-Regular, monospace",
            fontLigatures: true,
            fontSize,
            lineHeight,
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            matchBrackets: "always",
            minimap: { enabled: false },
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            padding: { top: 12, bottom: 12 },
            quickSuggestions: true,
            scrollBeyondLastLine: false,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              horizontalScrollbarSize: 8,
              verticalScrollbarSize: 8,
            },
            smoothScrolling: true,
            suggestOnTriggerCharacters: true,
            tabCompletion: "on",
            wordBasedSuggestions: "currentDocument",
            wordWrap: "on",
          }}
          theme={theme === "dark" ? "juro-author-dark" : "juro-author-light"}
          value={code}
          onChange={(value) => onChange(value ?? "")}
        />
      </div>
    </section>
  );
}
