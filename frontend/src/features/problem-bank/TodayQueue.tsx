import { CheckCircle2, Clock3, Play } from "lucide-react";
import type { TodayQueue as TodayQueueData, TodayQueueItem } from "../../types";

type Props = {
  queue: TodayQueueData | null;
  isLoading: boolean;
  busy: boolean;
  onStart: (problemId: string) => void;
};

function reasonLabel(reason: TodayQueueItem["reason"]): string {
  if (reason === "OVERDUE") return "Overdue";
  if (reason === "DUE_TODAY") return "Due today";
  return "New";
}

function trackLabel(track: TodayQueueItem["track"]): string {
  return track === "CODING" ? "Coding" : "Explain";
}

function difficultyLabel(difficulty: TodayQueueItem["difficulty"]): string {
  return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
}

function groupQueueItems(items: TodayQueueItem[]): Array<{ problem: TodayQueueItem; activities: TodayQueueItem[] }> {
  const groups = new Map<string, { problem: TodayQueueItem; activities: TodayQueueItem[] }>();
  for (const item of items) {
    const current = groups.get(item.problemId);
    if (current) {
      current.activities.push(item);
    } else {
      groups.set(item.problemId, { problem: item, activities: [item] });
    }
  }
  return [...groups.values()];
}

export function TodayQueue({ queue, isLoading, busy, onStart }: Props) {
  const problemGroups = queue ? groupQueueItems(queue.items) : [];

  return (
    <section className="today-queue" aria-label="Today queue" aria-busy={isLoading}>
      <header className="today-queue__header">
        <div>
          <p className="eyebrow">Today</p>
          <h2>Practice queue</h2>
        </div>
        {queue ? (
          <div className="today-queue__summary">
            <strong>{problemGroups.length}</strong>
            <span>{problemGroups.length === 1 ? "problem" : "problems"}</span>
            <span aria-hidden="true">·</span>
            <strong>{queue.items.length}</strong>
            <span>{queue.items.length === 1 ? "review" : "reviews"}</span>
            <span aria-hidden="true">·</span>
            <span>{queue.estimatedMinutes} min</span>
            {queue.completedToday > 0 ? (
              <span className="today-queue__completed">
                <CheckCircle2 size={14} aria-hidden="true" /> {queue.completedToday} done
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {isLoading && !queue ? <p className="today-queue__empty">Loading today’s practice…</p> : null}

      {!isLoading && queue && queue.items.length === 0 ? (
        <div className="today-queue__empty">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>You’re done for today. No reviews are due.</span>
        </div>
      ) : null}

      {queue && queue.items.length > 0 ? (
        <div className={`today-queue__items${problemGroups.length === 1 ? " today-queue__items--single" : ""}`}>
          {problemGroups.map((group) => (
            <article className="today-queue__item" key={group.problem.problemId}>
              <div className="today-queue__item-copy">
                <div className="today-queue__item-title-row">
                  <h3>{group.problem.title}</h3>
                </div>
                <p>{group.problem.summary}</p>
                <span className="today-queue__difficulty">{difficultyLabel(group.problem.difficulty)}</span>
              </div>
              <div className="today-queue__activities" aria-label={`Review types for ${group.problem.title}`}>
                {group.activities.map((item) => (
                  <button
                    aria-label={`Start ${trackLabel(item.track)} review for ${item.title}`}
                    className="today-queue__activity"
                    disabled={busy}
                    key={`${item.problemId}-${item.track}`}
                    onClick={() => onStart(item.problemId)}
                    type="button"
                  >
                    <span className="today-queue__activity-name">{trackLabel(item.track)}</span>
                    <span className={`today-queue__reason today-queue__reason--${item.reason.toLowerCase()}`}>
                      {reasonLabel(item.reason)}
                    </span>
                    <span className="today-queue__activity-time">
                      <Clock3 size={13} aria-hidden="true" /> {item.estimatedMinutes} min
                    </span>
                    <Play size={13} fill="currentColor" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
