import { useEffect, useState } from 'react';

const storageKey = 'juro-code-editor-font-size';
const minFontSize = 12;
const maxFontSize = 24;
const fallbackFontSize = 12;
const listeners = new Set<(fontSize: number) => void>();

function clampFontSize(value: number) {
  return Math.min(maxFontSize, Math.max(minFontSize, value));
}

function readStoredFontSize() {
  if (typeof window === 'undefined') {
    return fallbackFontSize;
  }

  const parsed = Number(window.localStorage.getItem(storageKey));
  return Number.isFinite(parsed) ? clampFontSize(parsed) : fallbackFontSize;
}

let currentFontSize = readStoredFontSize();

function setStoredFontSize(nextFontSize: number) {
  currentFontSize = clampFontSize(nextFontSize);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey, String(currentFontSize));
  }

  listeners.forEach((listener) => listener(currentFontSize));
}

export function useCodeEditorFontSize() {
  const [fontSize, setFontSize] = useState(currentFontSize);

  useEffect(() => {
    const listener = (nextFontSize: number) => setFontSize(nextFontSize);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    canDecrease: fontSize > minFontSize,
    canIncrease: fontSize < maxFontSize,
    decrease: () => setStoredFontSize(fontSize - 1),
    fontSize,
    increase: () => setStoredFontSize(fontSize + 1),
    lineHeight: Math.round(fontSize * 1.58),
  };
}
