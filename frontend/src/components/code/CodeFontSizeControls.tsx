import { useCodeEditorFontSize } from './useCodeEditorFontSize';

export function CodeFontSizeControls() {
  const { canDecrease, canIncrease, decrease, fontSize, increase } = useCodeEditorFontSize();

  return (
    <div className="code-font-controls" aria-label="Code editor font size">
      <button
        aria-label="Decrease code font size"
        className="code-font-button"
        disabled={!canDecrease}
        onClick={decrease}
        type="button"
      >
        A-
      </button>
      <span className="code-font-size-label">{fontSize}</span>
      <button
        aria-label="Increase code font size"
        className="code-font-button"
        disabled={!canIncrease}
        onClick={increase}
        type="button"
      >
        A+
      </button>
    </div>
  );
}
