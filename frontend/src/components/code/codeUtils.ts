import Editor from '@monaco-editor/react';
import type { ComponentProps } from 'react';
import type { ProblemType } from '../../types';

export type CodeLanguage = 'java' | 'json' | 'plaintext';
type MonacoBeforeMount = NonNullable<ComponentProps<typeof Editor>['beforeMount']>;
type Monaco = Parameters<MonacoBeforeMount>[0];

export function editorLanguageFor(type: ProblemType) {
  return "java";
}

export function configureMonacoTheme(monaco: Monaco) {
  monaco.editor.defineTheme("juro-liquid", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8C94A3", fontStyle: "italic" },
      { token: "keyword", foreground: "5486F7" },
      { token: "string", foreground: "1A9AA8" },
      { token: "number", foreground: "D8893B" },
    ],
    colors: {
      "editor.background": "#FBFBFD",
      "editor.lineHighlightBackground": "#F2F6FA",
      "editor.selectionBackground": "#DCEEFF",
      "editorLineNumber.foreground": "#A7AFBC",
      "editorLineNumber.activeForeground": "#586171",
      "editorCursor.foreground": "#33A4F5",
      "editorGutter.background": "#FBFBFD",
    },
  });

  monaco.editor.defineTheme("juro-author-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748B", fontStyle: "italic" },
      { token: "keyword", foreground: "A78BFA" },
      { token: "string", foreground: "86EFAC" },
      { token: "number", foreground: "FBBF24" },
      { token: "type", foreground: "7DD3FC" },
    ],
    colors: {
      "editor.background": "#0B1117",
      "editorLineNumber.foreground": "#64748B",
      "editorLineNumber.activeForeground": "#CBD5E1",
      "editorCursor.foreground": "#3B82F6",
      "editor.selectionBackground": "#1D4ED866",
      "editor.lineHighlightBackground": "#111827",
      "editorGutter.background": "#0B1117",
      "editorBracketMatch.background": "#1D4ED855",
      "editorBracketMatch.border": "#3B82F6",
    },
  });

  monaco.editor.defineTheme("juro-author-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94A3B8", fontStyle: "italic" },
      { token: "keyword", foreground: "2563EB" },
      { token: "string", foreground: "047857" },
      { token: "number", foreground: "B45309" },
      { token: "type", foreground: "0369A1" },
    ],
    colors: {
      "editor.background": "#FFFFFF",
      "editorLineNumber.foreground": "#CBD5E1",
      "editorLineNumber.activeForeground": "#475569",
      "editorCursor.foreground": "#3B82F6",
      "editor.selectionBackground": "#BFDBFE",
      "editor.lineHighlightBackground": "#F8FAFC",
      "editorGutter.background": "#FFFFFF",
      "editorBracketMatch.background": "#DBEAFE",
      "editorBracketMatch.border": "#3B82F6",
    },
  });
}

export function looksLikeJson(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("{")
    || trimmed.startsWith("[")
    || trimmed.startsWith("\"")
    || trimmed === "true"
    || trimmed === "false"
    || trimmed === "null"
    || /^-?\d+(\.\d+)?$/.test(trimmed);
}

export function formatCodeSnippet(value: string, language: CodeLanguage) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (language === "json" && looksLikeJson(trimmed)) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return value;
    }
  }

  return value;
}

export function codePreviewHeight(value: string, minimum = 104, maximum = 220) {
  const lineCount = Math.max(1, value.split(/\r?\n/).length);
  return `${Math.min(maximum, Math.max(minimum, lineCount * 20 + 22))}px`;
}

export function exampleInputLanguage(problemType: ProblemType): CodeLanguage {
  return "json";
}

export function exampleExpectedLanguage(value: string): CodeLanguage {
  return looksLikeJson(value) ? "json" : "plaintext";
}

export function isCompactValue(value: string) {
  return value.split(/\r?\n/).length <= 2 && value.length <= 80;
}
