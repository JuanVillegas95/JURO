import type { ActivityDay, ActivitySummary } from "../../types";

type Props = {
  activity: ActivitySummary | null;
  isLoading: boolean;
};

type HeatmapCell = ActivityDay & { inRange: boolean };

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildWeeks(activity: ActivitySummary): HeatmapCell[][] {
  const counts = new Map(activity.days.map((day) => [day.date, day.count]));
  const first = dateFromKey(activity.startDate);
  const last = dateFromKey(activity.endDate);
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(last);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));
  const weeks: HeatmapCell[][] = [];

  for (const weekStart = new Date(gridStart); weekStart <= gridEnd; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
    const week: HeatmapCell[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(weekStart);
      day.setUTCDate(day.getUTCDate() + offset);
      const date = dateKey(day);
      week.push({ date, count: counts.get(date) ?? 0, inRange: date >= activity.startDate && date <= activity.endDate });
    }
    weeks.push(week);
  }

  return weeks;
}

function activityLevel(count: number, maximum: number): number {
  if (count <= 0 || maximum <= 0) return 0;
  if (maximum <= 4) return Math.min(4, count);
  return Math.max(1, Math.ceil((count / maximum) * 4));
}

function formatActivityDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateFromKey(date));
}

function emptyActivitySummary(days: number): ActivitySummary {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const emptyDays: ActivityDay[] = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    emptyDays.push({ date: dateKey(date), count: 0 });
  }
  return {
    startDate: emptyDays[0]?.date ?? dateKey(start),
    endDate: emptyDays.at(-1)?.date ?? dateKey(end),
    totalActivity: 0,
    activeDays: 0,
    days: emptyDays,
  };
}

export function ActivityHeatmap({ activity, isLoading }: Props) {
  const displayActivity = activity ?? emptyActivitySummary(365);
  const weeks = buildWeeks(displayActivity);
  const maximum = Math.max(...displayActivity.days.map((day) => day.count), 0);
  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "short", timeZone: "UTC" });
  const monthLabels = weeks.map((week, index) => {
    const firstOfMonth = week.find((cell) => cell.inRange && cell.date.endsWith("-01"));
    return firstOfMonth ? (
      <span key={firstOfMonth.date} style={{ gridColumn: index + 1 }}>
        {monthFormatter.format(dateFromKey(firstOfMonth.date))}
      </span>
    ) : null;
  });

  return (
    <section className="activity-heatmap" aria-label="Activity heatmap" aria-busy={isLoading && !activity}>
      <div className="activity-heatmap__scroll" role="img" aria-label="Daily JURO activity for the last year">
        <div className="activity-heatmap__calendar">
          <div className="activity-heatmap__months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 0.76rem)` }}>
            {monthLabels}
          </div>
          <div className="activity-heatmap__calendar-body">
            <div className="activity-heatmap__weekdays" aria-hidden="true">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div
              className="activity-heatmap__grid"
              style={{
                gridTemplateRows: "repeat(7, 0.76rem)",
                gridAutoColumns: "0.76rem",
              }}
            >
              {weeks.flatMap((week) => week).map((cell) => (
                <span
                  className={`activity-heatmap__cell activity-heatmap__cell--level-${cell.inRange ? activityLevel(cell.count, maximum) : 0}${
                    !cell.inRange ? " activity-heatmap__cell--outside" : ""
                  }`}
                  key={cell.date}
                  title={cell.inRange ? `${cell.count} ${cell.count === 1 ? "activity" : "activities"} on ${formatActivityDate(cell.date)}` : undefined}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="activity-heatmap__legend" aria-hidden="true">
        <span>Less</span>
        <i className="activity-heatmap__cell activity-heatmap__cell--level-0" />
        <i className="activity-heatmap__cell activity-heatmap__cell--level-1" />
        <i className="activity-heatmap__cell activity-heatmap__cell--level-2" />
        <i className="activity-heatmap__cell activity-heatmap__cell--level-3" />
        <i className="activity-heatmap__cell activity-heatmap__cell--level-4" />
        <span>More</span>
      </div>
    </section>
  );
}
