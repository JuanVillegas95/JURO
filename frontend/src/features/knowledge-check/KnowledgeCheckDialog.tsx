import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Mic, RefreshCw, Send, Square, X, XCircle } from "lucide-react";
import { evaluateProblemKnowledge, recordReviewResult } from "../../api";
import type { KnowledgeEvaluationResult, ProblemSummary, ReviewState } from "../../types";
import { displayDifficulty } from "../problem-bank/catalog";

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((
    event: {
      resultIndex?: number;
      results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
    },
  ) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type KnowledgeCheckDialogProps = {
  problem: ProblemSummary;
  onClose: () => void;
  onEvaluated: (result: KnowledgeEvaluationResult) => void;
  onReviewGraded: (review: ReviewState) => void;
};

function normalizeSpeechChunk(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function mergeSpeechTranscript(base: string, addition: string) {
  const normalizedBase = base.trim();
  const normalizedAddition = normalizeSpeechChunk(addition);

  if (!normalizedAddition) {
    return normalizedBase;
  }

  if (!normalizedBase) {
    return normalizedAddition;
  }

  const baseWords = normalizedBase.split(/\s+/);
  const additionWords = normalizedAddition.split(/\s+/);
  const maxOverlap = Math.min(baseWords.length, additionWords.length, 12);

  for (let size = maxOverlap; size > 0; size -= 1) {
    const baseTail = baseWords.slice(-size).join(" ").toLowerCase();
    const additionHead = additionWords.slice(0, size).join(" ").toLowerCase();

    if (baseTail === additionHead) {
      return `${normalizedBase} ${additionWords.slice(size).join(" ")}`.trim();
    }
  }

  return `${normalizedBase} ${normalizedAddition}`.trim();
}

export function KnowledgeCheckDialog({ problem, onClose, onEvaluated, onReviewGraded }: KnowledgeCheckDialogProps) {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeMessage, setGradeMessage] = useState<string | null>(null);
  const [result, setResult] = useState<KnowledgeEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const committedTranscriptRef = useRef("");
  const sessionFinalChunksRef = useRef<string[]>([]);
  const shouldKeepRecordingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const recognitionRunIdRef = useRef(0);

  const SpeechRecognition = useMemo(() => {
    const browserWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
  }, []);
  const speechSupported = Boolean(SpeechRecognition);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      shouldKeepRecordingRef.current = false;
      clearRestartTimer();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.stop();
      }
    };
  }, [onClose]);

  function clearRestartTimer() {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function sessionFinalText() {
    return sessionFinalChunksRef.current.filter(Boolean).join(" ");
  }

  function commitSessionTranscript() {
    const mergedTranscript = mergeSpeechTranscript(committedTranscriptRef.current, sessionFinalText());
    committedTranscriptRef.current = mergedTranscript;
    sessionFinalChunksRef.current = [];
    setTranscript(mergedTranscript);
    setInterimTranscript("");
  }

  function startRecognitionSession(runId = recognitionRunIdRef.current) {
    if (!SpeechRecognition || !shouldKeepRecordingRef.current || runId !== recognitionRunIdRef.current) {
      return;
    }

    clearRestartTimer();
    sessionFinalChunksRef.current = [];

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (runId !== recognitionRunIdRef.current) {
        return;
      }

      const interimChunks: string[] = [];
      const startIndex = event.resultIndex ?? 0;

      for (let index = startIndex; index < event.results.length; index += 1) {
        const item = event.results[index];
        const spokenText = normalizeSpeechChunk(item[0].transcript);

        if (!spokenText) {
          continue;
        }

        if (item.isFinal) {
          sessionFinalChunksRef.current[index] = spokenText;
        } else {
          interimChunks.push(spokenText);
        }
      }

      const nextTranscript = mergeSpeechTranscript(committedTranscriptRef.current, sessionFinalText());
      const nextInterimTranscript = normalizeSpeechChunk(interimChunks.join(" "));

      setTranscript(nextTranscript);
      setInterimTranscript(
        nextInterimTranscript && nextTranscript.toLowerCase().endsWith(nextInterimTranscript.toLowerCase())
          ? ""
          : nextInterimTranscript,
      );
    };
    recognition.onerror = (event) => {
      if (runId !== recognitionRunIdRef.current) {
        return;
      }

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldKeepRecordingRef.current = false;
        setIsRecording(false);
        setError("Microphone permission was denied. Allow microphone access or type the explanation manually.");
        return;
      }

      if (event.error === "audio-capture") {
        shouldKeepRecordingRef.current = false;
        setIsRecording(false);
        setError("No microphone was detected. Check your input device or type the explanation manually.");
      }
    };
    recognition.onend = () => {
      if (runId !== recognitionRunIdRef.current) {
        return;
      }

      commitSessionTranscript();
      recognitionRef.current = null;

      if (!shouldKeepRecordingRef.current) {
        setIsRecording(false);
        return;
      }

      setIsRecording(true);
      restartTimerRef.current = window.setTimeout(() => startRecognitionSession(runId), 220);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsRecording(true);
    } catch (startError) {
      shouldKeepRecordingRef.current = false;
      recognitionRef.current = null;
      setIsRecording(false);
      setError(startError instanceof Error ? startError.message : "Unable to start speech recognition.");
    }
  }

  function startRecording() {
    if (!SpeechRecognition) {
      setError("Speech recognition is not available in this browser. Type or paste the explanation instead.");
      return;
    }

    setError(null);
    committedTranscriptRef.current = transcript.trim();
    shouldKeepRecordingRef.current = true;
    recognitionRunIdRef.current += 1;
    startRecognitionSession(recognitionRunIdRef.current);
  }

  function stopRecording() {
    shouldKeepRecordingRef.current = false;
    clearRestartTimer();
    commitSessionTranscript();
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  async function submitEvaluation() {
    if (!transcript.trim()) {
      setError("Add an explanation before submitting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setGradeMessage(null);
    try {
      const response = await evaluateProblemKnowledge(problem.id, transcript.trim());
      setResult(response);
      onEvaluated(response);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to evaluate explanation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function gradeExplanation(passed: boolean) {
    setIsGrading(true);
    setError(null);
    try {
      const review = await recordReviewResult(problem.id, "EXPLANATION", passed);
      onReviewGraded(review);
      setGradeMessage(
        passed
          ? `Explanation marked passed. Next explanation review is scheduled in ${review.intervalDays} day${review.intervalDays === 1 ? "" : "s"}.`
          : `Explanation marked for review. It will be due again in ${review.intervalDays} day${review.intervalDays === 1 ? "" : "s"}.`,
      );
    } catch (gradeError) {
      setError(gradeError instanceof Error ? gradeError.message : "Unable to update the explanation review schedule.");
    } finally {
      setIsGrading(false);
    }
  }

  return (
    <div
      className="knowledge-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section aria-label="Knowledge check" aria-modal="true" className="knowledge-dialog" role="dialog">
        <header className="knowledge-dialog__header">
          <div>
            <span className="section-kicker">Knowledge Check</span>
            <h2>{problem.title}</h2>
            <p>
              Explain the approach, edge cases, and complexity. The configured local AI evaluator will compare it with the
              problem rubric.
            </p>
          </div>
          <button aria-label="Close knowledge check" className="icon-button" onClick={onClose} type="button">
            <X size={17} strokeWidth={2.35} />
          </button>
        </header>

        <div className="knowledge-dialog__body">
          <div className="knowledge-dialog__meta">
            <span className="tag tag--java">JAVA</span>
            <span className={`tag tag--${problem.difficulty.toLowerCase()}`}>{displayDifficulty(problem.difficulty)}</span>
          </div>

          <label className="settings-field">
            <span>Transcript</span>
            <textarea
              placeholder="Explain how you would solve this problem..."
              value={interimTranscript ? `${transcript}\n${interimTranscript}`.trim() : transcript}
              onChange={(event) => {
                const nextTranscript = event.target.value;
                setTranscript(nextTranscript);
                committedTranscriptRef.current = nextTranscript.trim();
                sessionFinalChunksRef.current = [];
                setInterimTranscript("");
              }}
            />
            <small>
              {isRecording
                ? "Recording... JURO keeps listening through pauses until you press Stop."
                : speechSupported
                  ? "Use recording or type manually. Browser speech recognition handles transcription."
                  : "Speech recognition is unavailable here, so use the manual text fallback."}
            </small>
          </label>

          {error ? <div className="error-banner">{error}</div> : null}

          {isSubmitting ? (
            <section className="knowledge-evaluation-progress" aria-live="polite">
              <div>
                <strong>AI evaluator is judging your explanation</strong>
                <span>JURO is sending the transcript to the configured local model through the backend.</span>
              </div>
              <div className="knowledge-evaluation-progress__bar" aria-hidden="true">
                <span />
              </div>
            </section>
          ) : null}

          {result ? (
            <section className={`knowledge-result knowledge-result--${result.status.toLowerCase().replace("_", "-")}`}>
              <div className="knowledge-result__score">
                <strong>{result.score}</strong>
                <span>{result.status.replace("_", " ")}</span>
              </div>
              <span className="knowledge-result__model">Model: {result.model}</span>
              <p>{result.summary}</p>
              <ResultList title="Strengths" items={result.strengths} />
              <ResultList title="Missing concepts" items={result.missingConcepts} />
              {result.suggestedReview ? <p className="knowledge-result__review">{result.suggestedReview}</p> : null}
              {result.status !== "ERROR" ? (
                <section className="review-grade-panel" aria-label="Grade explanation review">
                  <div>
                    <strong>Your grade controls the reminder</strong>
                    <span>Use the LLM output as advice, then decide whether this explanation should count.</span>
                  </div>
                  <div className="review-grade-panel__actions">
                    <button
                      className="button button--ghost button--sm review-grade-button review-grade-button--fail"
                      disabled={isGrading}
                      onClick={() => void gradeExplanation(false)}
                      type="button"
                    >
                      <XCircle size={14} />
                      Needs review
                    </button>
                    <button
                      className="button button--primary button--sm review-grade-button review-grade-button--pass"
                      disabled={isGrading}
                      onClick={() => void gradeExplanation(true)}
                      type="button"
                    >
                      <CheckCircle2 size={14} />
                      Passed
                    </button>
                  </div>
                  {gradeMessage ? <p className="review-grade-panel__message">{gradeMessage}</p> : null}
                </section>
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="knowledge-dialog__footer">
          <button
            className="button button--ghost button--sm"
            disabled={!speechSupported || isSubmitting}
            onClick={isRecording ? stopRecording : startRecording}
            type="button"
          >
            {isRecording ? <Square size={14} /> : <Mic size={14} />}
            {isRecording ? "Stop" : "Record"}
          </button>
          <button className="button button--primary button--sm" disabled={isSubmitting} onClick={submitEvaluation} type="button">
            {isSubmitting ? <RefreshCw size={14} /> : <Send size={14} />}
            Evaluate
          </button>
        </footer>
      </section>
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="knowledge-result__list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
