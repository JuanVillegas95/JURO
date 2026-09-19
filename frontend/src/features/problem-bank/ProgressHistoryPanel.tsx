import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, History, RotateCcw, Trophy, XCircle } from "lucide-react";
import { getProblemProgressHistory } from "../../api";
import type { ProblemProgressHistory, ReviewHistoryEntry, TestAttemptHistory, KnowledgeCheckHistoryEntry } from "../../types";

type Props = {
  problemId: string;
};

type TimelineItem = {
  id: string;
  kind: "TEST" | "REVIEW" | "KNOWLEDGE";
  label: string;
  detail: string;
  date: string;
  passed?: boolean;
};

function formatDuration(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function testTimelineItem(item: TestAttemptHistory): TimelineItem {
  const passed = item.status === "PASSED";
  return {
    id: `test-${item.id}`,
    kind: "TEST",
    label: `Test attempt · ${item.status.replaceAll("_", " ")}`,
    detail: `${item.passedCases}/${item.totalCases} cases passed · ${item.runtimeMillis} ms`,
    date: item.createdAt,
    passed,
  };
}

function reviewTimelineItem(item: ReviewHistoryEntry): TimelineItem {
  return {
    id: `review-${item.id}`,
    kind: "REVIEW",
    label: `${item.track === "CODING" ? "Coding" : "Explanation"} review · ${item.passed ? "Passed" : "Needs review"}`,
    detail: `Next review ${formatDate(item.newDueAt)}`,
    date: item.createdAt,
    passed: item.passed,
  };
}

function knowledgeTimelineItem(item: KnowledgeCheckHistoryEntry): TimelineItem {
  return {
    id: `knowledge-${item.id}`,
    kind: "KNOWLEDGE",
    label: `Knowledge check · ${item.score}/100`,
    detail: item.status.replaceAll("_", " "),
    date: item.createdAt,
    passed: item.status === "PASSED",
  };
}

export function ProgressHistoryPanel({ problemId }: Props) {
  const [history, setHistory] = useState<ProblemProgressHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getProblemProgressHistory(problemId)
      .then((response) => {
        if (active) {
          setHistory(response);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load progress history.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [problemId]);

  const timeline = useMemo(() => {
    if (!history) return [];
    return [
      ...history.testAttempts.map(testTimelineItem),
      ...history.reviews.map(reviewTimelineItem),
      ...history.knowledgeChecks.map(knowledgeTimelineItem),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6);
  }, [history]);

  if (isLoading) {
    return <section className="progress-history progress-history--loading">Loading progress history…</section>;
  }

  if (error) {
    return <section className="progress-history progress-history--error">Progress history unavailable: {error}</section>;
  }

  if (!history) return null;

  const { summary } = history;
  return (
    <section className="progress-history" aria-label="Progress history">
      <header className="progress-history__header">
        <div>
          <span className="section-kicker">Progress</span>
          <h3>Reliable history</h3>
        </div>
        {summary.lastActivityAt ? <span>Last activity {formatDate(summary.lastActivityAt)}</span> : null}
      </header>

      <div className="progress-history__stats">
        <div className="progress-history__stat">
          <RotateCcw size={14} aria-hidden="true" />
          <strong>{summary.attempts}</strong>
          <span>Attempts</span>
        </div>
        <div className="progress-history__stat">
          <CheckCircle2 size={14} aria-hidden="true" />
          <strong>{summary.passedTestCases}/{summary.totalTestCases}</strong>
          <span>Tests passed</span>
        </div>
        <div className="progress-history__stat">
          <Clock3 size={14} aria-hidden="true" />
          <strong>{formatDuration(summary.timeSpentMillis)}</strong>
          <span>Time spent</span>
        </div>
        <div className="progress-history__stat">
          <Trophy size={14} aria-hidden="true" />
          <strong>{summary.averageKnowledgeScore == null ? "—" : summary.averageKnowledgeScore}</strong>
          <span>Knowledge avg</span>
        </div>
      </div>

      {timeline.length > 0 ? (
        <div className="progress-history__timeline">
          {timeline.map((item) => (
            <div className="progress-history__event" key={item.id}>
              <span className={`progress-history__event-icon progress-history__event-icon--${item.passed == null ? "neutral" : item.passed ? "passed" : "failed"}`}>
                {item.passed === false ? <XCircle size={13} /> : item.passed === true ? <CheckCircle2 size={13} /> : <History size={13} />}
              </span>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              <time dateTime={item.date}>{formatDate(item.date)}</time>
            </div>
          ))}
        </div>
      ) : (
        <p className="progress-history__empty">No attempts or reviews recorded yet.</p>
      )}
    </section>
  );
}
