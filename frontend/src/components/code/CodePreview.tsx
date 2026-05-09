import Editor from '@monaco-editor/react';
import { useAppTheme } from '../../app/theme';
import { codePreviewHeight, configureMonacoTheme, formatCodeSnippet, type CodeLanguage } from './codeUtils';

export type CodePreviewProps = {
  value: string;
  language: CodeLanguage;
  minHeight?: number;
  maxHeight?: number;
};

export function CodePreview({ value, language, minHeight = 104, maxHeight = 220 }: CodePreviewProps) {
  const { theme } = useAppTheme();
  const normalized = formatCodeSnippet(value, language);

  return (
    <div className="code-preview">
      <Editor
        beforeMount={configureMonacoTheme}
        height={codePreviewHeight(normalized, minHeight, maxHeight)}
        language={language}
        options={{
          automaticLayout: true,
          domReadOnly: true,
          fontFamily: "Chakra Petch, monospace",
          fontLigatures: true,
          fontSize: 11,
          glyphMargin: false,
          lineHeight: 18,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          padding: { top: 10, bottom: 10 },
          readOnly: true,
          renderLineHighlight: "none",
          scrollBeyondLastLine: false,
          scrollbar: {
            alwaysConsumeMouseWheel: false,
            horizontalScrollbarSize: 6,
            verticalScrollbarSize: 6,
          },
          wordWrap: "on",
        }}
        theme={theme === "dark" ? "juro-author-dark" : "juro-liquid"}
        value={normalized}
      />
    </div>
  );
}
