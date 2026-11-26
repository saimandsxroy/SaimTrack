import {
  DEFAULT_DAILY_ENGLISH_GOAL_MS,
  ENGLISH_MODULE_ID,
  type EnglishCommunicationStateDoc,
  type GoalHistoryEntry,
} from "@/features/english-communication/english-types";
import type { TimeEntry, TimerInterval } from "@/features/time-tracker/time-tracker-types";

export type DailyEnglishSummary = {
  dateKey: string;
  durationMs: number;
  sessionCount: number;
  goalMs: number;
  completed: boolean;
  isRestDay: boolean;
  sessions: TimeEntry[];
};

export type EnglishStreakMetrics = {
  todayKey: string;
  todayDurationMs: number;
  todayGoalMs: number;
  todayGoalCompleted: boolean;
  todayProgressPercent: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletedDays: number;
  totalActiveDays: number;
  dailyCompletionRate: number;
  weeklyDurationMs: number;
  monthlyDurationMs: number;
  yearlyDurationMs: number;
  lifetimeDurationMs: number;
  totalSessionsCount: number;
  dailyMap: Map<string, DailyEnglishSummary>;
};

export function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

/**
 * Formats an instant or Date into a YYYY-MM-DD local calendar key in the given IANA timezone.
 */
export function toZonedDateKey(input: Date | string | number, timezone: string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return toZonedDateKey(new Date(), timezone);
  }
  try {
    // en-CA produces YYYY-MM-DD cleanly
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Adds/subtracts calendar days on a YYYY-MM-DD key safely across month/year boundaries.
 */
export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0);
  const dt = new Date(utc);
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function diffDateKeys(earlierKey: string, laterKey: string): number {
  const [y1, m1, d1] = earlierKey.split("-").map(Number);
  const [y2, m2, d2] = laterKey.split("-").map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86_400_000);
}

/**
 * Deduplicate entries by stable session ID so duplicate writes/offline replays never inflate totals.
 */
export function deduplicateEntries(entries: TimeEntry[]): TimeEntry[] {
  const seen = new Set<string>();
  const result: TimeEntry[] = [];
  for (const entry of entries) {
    if (!entry?.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

export function isEnglishEntry(entry: TimeEntry): boolean {
  return entry.module === ENGLISH_MODULE_ID;
}

export function getEnglishEntries(entries: TimeEntry[]): TimeEntry[] {
  return deduplicateEntries(entries).filter(isEnglishEntry);
}

/**
 * Finds the UTC timestamp of the next local midnight strictly after `ms` in `timezone`.
 */
function findNextZonedMidnightMs(ms: number, timezone: string): number {
  const currentKey = toZonedDateKey(ms, timezone);
  const nextKey = addDaysToDateKey(currentKey, 1);

  // Coarse search: jump by 1 hour until dateKey changes, then binary search to the millisecond
  let lo = ms;
  let hi = ms + 36 * 3600_000;
  // Narrow hi to the first hour in nextKey (or beyond)
  for (let probe = ms + 3600_000; probe <= hi; probe += 3600_000) {
    if (toZonedDateKey(probe, timezone) >= nextKey) {
      hi = probe;
      lo = Math.max(ms, probe - 3600_000);
      break;
    }
  }

  while (lo + 1000 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (toZonedDateKey(mid, timezone) >= nextKey) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  // Exact second boundary alignment
  for (let t = lo; t <= hi; t += 1000) {
    if (toZonedDateKey(t, timezone) >= nextKey) return t;
  }
  return hi;
}

function splitIntervalAcrossDays(
  startMs: number,
  endMs: number,
  timezone: string,
): Array<{ dateKey: string; ms: number }> {
  if (endMs <= startMs) return [];
  const segments: Array<{ dateKey: string; ms: number }> = [];
  let cursor = startMs;
  let safety = 0;

  while (cursor < endMs && safety < 366) {
    safety += 1;
    const key = toZonedDateKey(cursor, timezone);
    const midnightMs = findNextZonedMidnightMs(cursor, timezone);
    const segmentEnd = Math.min(endMs, midnightMs);
    const chunkMs = Math.max(0, segmentEnd - cursor);
    if (chunkMs > 0) {
      segments.push({ dateKey: key, ms: chunkMs });
    }
    cursor = segmentEnd;
    if (segmentEnd === midnightMs && cursor < endMs && toZonedDateKey(cursor, timezone) === key) {
      cursor += 1000;
    }
  }
  return segments;
}

/**
 * Allocates an entry's actual practiced duration across local calendar days in `timezone`.
 * Uses exact `intervals` when present (excluding paused time), or scales across midnight if
 * startTime/endTime span days, falling back to `entry.date` if timestamps are identical/invalid.
 */
export function allocateEntryAcrossDays(
  entry: TimeEntry,
  timezone: string,
): Map<string, number> {
  const allocation = new Map<string, number>();
  const totalDuration = Math.max(0, entry.duration || 0);
  if (totalDuration === 0) {
    const fallbackKey = toZonedDateKey(entry.date || entry.startTime, timezone);
    allocation.set(fallbackKey, 0);
    return allocation;
  }

  const intervals: TimerInterval[] | undefined =
    entry.intervals && entry.intervals.length > 0 ? entry.intervals : undefined;

  if (intervals) {
    let rawSegments: Array<{ dateKey: string; ms: number }> = [];
    for (const iv of intervals) {
      const s = new Date(iv.start).getTime();
      const e = new Date(iv.end).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
        rawSegments = rawSegments.concat(splitIntervalAcrossDays(s, e, timezone));
      }
    }

    const rawSum = rawSegments.reduce((acc, seg) => acc + seg.ms, 0);
    if (rawSum > 0) {
      let distributed = 0;
      rawSegments.forEach((seg, idx) => {
        const isLast = idx === rawSegments.length - 1;
        const part = isLast
          ? Math.max(0, totalDuration - distributed)
          : Math.round((seg.ms / rawSum) * totalDuration);
        distributed += part;
        allocation.set(seg.dateKey, (allocation.get(seg.dateKey) ?? 0) + part);
      });
      return allocation;
    }
  }

  // Fallback for entries without intervals (e.g., manual entries or historical entries)
  const startMs = new Date(entry.startTime).getTime();
  const endMs = new Date(entry.endTime).getTime();
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
    const startKey = toZonedDateKey(startMs, timezone);
    const endKey = toZonedDateKey(endMs - 1, timezone);
    if (startKey === endKey) {
      allocation.set(startKey, totalDuration);
      return allocation;
    }

    const wallSegments = splitIntervalAcrossDays(startMs, endMs, timezone);
    const wallSum = wallSegments.reduce((acc, s) => acc + s.ms, 0);
    if (wallSum > 0) {
      let distributed = 0;
      wallSegments.forEach((seg, idx) => {
        const isLast = idx === wallSegments.length - 1;
        const part = isLast
          ? Math.max(0, totalDuration - distributed)
          : Math.round((seg.ms / wallSum) * totalDuration);
        distributed += part;
        allocation.set(seg.dateKey, (allocation.get(seg.dateKey) ?? 0) + part);
      });
      return allocation;
    }
  }

  const fallbackKey = toZonedDateKey(entry.date || entry.startTime, timezone);
  allocation.set(fallbackKey, totalDuration);
  return allocation;
}

export function getEffectiveGoalForDate(
  dateKey: string,
  goalHistory: GoalHistoryEntry[],
  currentGoalMs: number,
): number {
  if (!goalHistory || goalHistory.length === 0) {
    return currentGoalMs || DEFAULT_DAILY_ENGLISH_GOAL_MS;
  }

  const sorted = [...goalHistory].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  let matched: number | null = null;
  for (const item of sorted) {
    if (item.effectiveDate <= dateKey) {
      matched = item.goalMs;
    }
  }

  // If dateKey predates the earliest recorded change, use the earliest recorded goal
  // (or default 30m) so historical achievements aren't silently broken by newer edits.
  return matched ?? sorted[0]?.goalMs ?? currentGoalMs ?? DEFAULT_DAILY_ENGLISH_GOAL_MS;
}

export function computeEnglishStreakMetrics(
  allEntries: TimeEntry[],
  settings: Pick<
    EnglishCommunicationStateDoc,
    "dailyGoalMs" | "timezone" | "goalHistory" | "plannedRestDays"
  >,
  nowDate = new Date(),
): EnglishStreakMetrics {
  const timezone = settings.timezone || getDefaultTimezone();
  const todayKey = toZonedDateKey(nowDate, timezone);
  const englishEntries = getEnglishEntries(allEntries);
  const restDaysSet = new Set(settings.plannedRestDays || []);

  const dailyMap = new Map<string, DailyEnglishSummary>();

  const ensureDay = (dateKey: string): DailyEnglishSummary => {
    let existing = dailyMap.get(dateKey);
    if (!existing) {
      const goalMs = getEffectiveGoalForDate(dateKey, settings.goalHistory, settings.dailyGoalMs);
      existing = {
        dateKey,
        durationMs: 0,
        sessionCount: 0,
        goalMs,
        completed: false,
        isRestDay: restDaysSet.has(dateKey),
        sessions: [],
      };
      dailyMap.set(dateKey, existing);
    }
    return existing;
  };

  let lifetimeDurationMs = 0;

  for (const entry of englishEntries) {
    lifetimeDurationMs += Math.max(0, entry.duration || 0);
    const dayAllocations = allocateEntryAcrossDays(entry, timezone);
    for (const [dateKey, ms] of dayAllocations.entries()) {
      const summary = ensureDay(dateKey);
      summary.durationMs += ms;
      summary.sessionCount += 1;
      summary.sessions.push(entry);
    }
  }

  // Mark completion status on all populated days & planned rest days
  for (const restKey of restDaysSet) {
    ensureDay(restKey);
  }
  for (const summary of dailyMap.values()) {
    summary.completed = summary.durationMs >= summary.goalMs;
  }

  // Period totals anchored to todayKey in configured timezone
  const todaySummary = ensureDay(todayKey);
  const todayDurationMs = todaySummary.durationMs;
  const todayGoalMs = todaySummary.goalMs;
  const todayGoalCompleted = todaySummary.completed;
  const todayProgressPercent =
    todayGoalMs > 0 ? Math.min(100, Math.round((todayDurationMs / todayGoalMs) * 100)) : 0;

  // Week starts Monday
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const todayUtc = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
  const weekday = todayUtc.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const weekStartKey = addDaysToDateKey(todayKey, -mondayOffset);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  const yearStartKey = `${todayKey.slice(0, 4)}-01-01`;

  let weeklyDurationMs = 0;
  let monthlyDurationMs = 0;
  let yearlyDurationMs = 0;
  let totalCompletedDays = 0;
  let totalActiveDays = 0;

  for (const summary of dailyMap.values()) {
    if (summary.durationMs > 0) totalActiveDays += 1;
    if (summary.completed) totalCompletedDays += 1;
    if (summary.dateKey >= weekStartKey && summary.dateKey <= todayKey) {
      weeklyDurationMs += summary.durationMs;
    }
    if (summary.dateKey >= monthStartKey && summary.dateKey <= todayKey) {
      monthlyDurationMs += summary.durationMs;
    }
    if (summary.dateKey >= yearStartKey && summary.dateKey <= todayKey) {
      yearlyDurationMs += summary.durationMs;
    }
  }

  // ─── Streak Calculation (reusing Habit Tracker consecutive-day logic + rest days + incomplete today) ───
  const completedKeys = new Set<string>();
  for (const summary of dailyMap.values()) {
    if (summary.completed) completedKeys.add(summary.dateKey);
  }

  // Current streak: walk backwards from today (if today incomplete and not rest, start from yesterday)
  let currentStreak = 0;
  let cursor =
    completedKeys.has(todayKey) || restDaysSet.has(todayKey)
      ? todayKey
      : addDaysToDateKey(todayKey, -1);

  for (let i = 0; i < 3650; i += 1) {
    if (completedKeys.has(cursor)) {
      currentStreak += 1;
      cursor = addDaysToDateKey(cursor, -1);
    } else if (restDaysSet.has(cursor)) {
      // Planned rest day preserves streak without adding streak credit
      cursor = addDaysToDateKey(cursor, -1);
    } else {
      break;
    }
  }

  // Longest streak across all historical completed + rest days
  let longestStreak = 0;
  const sortedDates = Array.from(new Set([...completedKeys, ...restDaysSet])).sort();
  let running = 0;
  let prevDate: string | null = null;

  for (const key of sortedDates) {
    if (key > todayKey) continue;
    if (prevDate && diffDateKeys(prevDate, key) === 1) {
      if (completedKeys.has(key)) running += 1;
    } else {
      running = completedKeys.has(key) ? 1 : 0;
    }
    longestStreak = Math.max(longestStreak, running);
    prevDate = key;
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // Daily completion rate since first practice day (excluding future dates)
  const activeSorted = Array.from(dailyMap.values())
    .filter((d) => d.durationMs > 0 && d.dateKey <= todayKey)
    .map((d) => d.dateKey)
    .sort();
  let dailyCompletionRate = 0;
  if (activeSorted.length > 0) {
    const firstKey = activeSorted[0];
    const spanDays = Math.max(1, diffDateKeys(firstKey, todayKey) + 1);
    // Subtract planned rest days inside the span so rest days don't penalize completion rate
    let restInsideSpan = 0;
    for (const rk of restDaysSet) {
      if (rk >= firstKey && rk <= todayKey && !completedKeys.has(rk)) {
        restInsideSpan += 1;
      }
    }
    const denominator = Math.max(1, spanDays - restInsideSpan);
    dailyCompletionRate = Math.min(100, Math.round((totalCompletedDays / denominator) * 100));
  }

  return {
    todayKey,
    todayDurationMs,
    todayGoalMs,
    todayGoalCompleted,
    todayProgressPercent,
    currentStreak,
    longestStreak,
    totalCompletedDays,
    totalActiveDays,
    dailyCompletionRate,
    weeklyDurationMs,
    monthlyDurationMs,
    yearlyDurationMs,
    lifetimeDurationMs,
    totalSessionsCount: englishEntries.length,
    dailyMap,
  };
}
