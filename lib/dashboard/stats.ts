// Pure helpers for the participant dashboard. Points always come from the
// server ledger; these functions only summarize them for display.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface LedgerEvent {
  amount: number;
  created_at: string;
  kind: string;
}

export interface CampaignProgress {
  daysLeft: number;
  phase: "upcoming" | "active" | "ended";
  /** 1-based current week; 0 before the start. */
  week: number;
  weeks: number;
}

export function campaignProgress(now: Date, startsAt: string | null, endsAt: string | null): CampaignProgress | null {
  if (!startsAt || !endsAt) {
    return null;
  }

  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const weeks = Math.max(1, Math.ceil((end - start) / WEEK_MS));
  const time = now.getTime();

  if (time < start) {
    return { daysLeft: Math.ceil((end - time) / DAY_MS), phase: "upcoming", week: 0, weeks };
  }

  if (time >= end) {
    return { daysLeft: 0, phase: "ended", week: weeks, weeks };
  }

  return {
    daysLeft: Math.ceil((end - time) / DAY_MS),
    phase: "active",
    week: Math.min(weeks, Math.floor((time - start) / WEEK_MS) + 1),
    weeks,
  };
}

/** Net points per campaign week (index 0 = week 1). Events outside the range are clamped. */
export function pointsByWeek(events: readonly LedgerEvent[], startsAt: string, weeks: number): number[] {
  const start = Date.parse(startsAt);
  const totals = Array.from({ length: weeks }, () => 0);

  for (const event of events) {
    const index = Math.floor((Date.parse(event.created_at) - start) / WEEK_MS);
    const week = Math.min(weeks - 1, Math.max(0, index));
    totals[week] = (totals[week] ?? 0) + event.amount;
  }

  return totals;
}

export interface PointsBreakdown {
  adjustments: number;
  missions: number;
  quizzes: number;
  speed: number;
}

export function pointsBreakdown(events: readonly LedgerEvent[]): PointsBreakdown {
  const result: PointsBreakdown = { adjustments: 0, missions: 0, quizzes: 0, speed: 0 };

  for (const event of events) {
    if (event.kind === "quiz" || event.kind === "open_review") {
      result.quizzes += event.amount;
    } else if (event.kind === "quiz_speed_bonus") {
      result.speed += event.amount;
    } else if (event.kind === "mission") {
      result.missions += event.amount;
    } else {
      result.adjustments += event.amount;
    }
  }

  return result;
}

export interface RankedPoints {
  points: number;
  standing: number;
}

export type NextGoal =
  | { kind: "lead"; margin: number }
  | { kind: "climb"; missing: number; target: number }
  | { kind: "top"; missing: number; top: number };

/**
 * What the participant needs next: points to enter the Top N, to pass the
 * position right above, or the current lead when first.
 */
export function nextGoal(rows: readonly RankedPoints[], mine: RankedPoints, top = 5): NextGoal | null {
  const ahead = rows.filter((row) => row.points > mine.points);

  if (ahead.length === 0) {
    const second = rows.filter((row) => row.points < mine.points).reduce((max, row) => Math.max(max, row.points), 0);
    return mine.points > 0 ? { kind: "lead", margin: mine.points - second } : null;
  }

  if (mine.standing > top) {
    const cutoff = rows.find((row) => row.standing === top) ?? rows.filter((row) => row.standing <= top).at(-1);
    return cutoff ? { kind: "top", missing: cutoff.points - mine.points + 1, top } : null;
  }

  const above = ahead.reduce((closest, row) => (row.points < closest.points ? row : closest));
  return { kind: "climb", missing: above.points - mine.points + 1, target: above.standing };
}
