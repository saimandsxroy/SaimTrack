import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAchievements } from "../features/english-communication/english-achievements";
import { getChallengeForDateKey } from "../features/english-communication/english-challenges";
import {
  englishStateDocSchema,
  timeEntrySchema,
  vocabularyItemSchema,
} from "../features/english-communication/english-schemas";
import {
  calculateNextReview,
  isItemDue,
  sortRevisionQueue,
} from "../features/english-communication/english-srs";
import {
  addDaysToDateKey,
  allocateEntryAcrossDays,
  computeEnglishStreakMetrics,
  deduplicateEntries,
  getEffectiveGoalForDate,
  getEnglishEntries,
} from "../features/english-communication/english-streak";
import {
  DEFAULT_DAILY_ENGLISH_GOAL_MS,
  ENGLISH_MODULE_ID,
  type VocabularyItem,
} from "../features/english-communication/english-types";
import { pauseActiveTimer } from "../features/time-tracker/time-tracker-storage";
import type { TimeEntry } from "../features/time-tracker/time-tracker-types";
import { sumDuration } from "../features/time-tracker/time-tracker-utils";

const TZ = "Asia/Kolkata";

function makeEnglishEntry(
  id: string,
  dateKey: string,
  durationMs: number,
  overrides: Partial<TimeEntry> = {},
): TimeEntry {
  // 10:00 AM IST (+05:30) on dateKey
  const startIso = `${dateKey}T10:00:00+05:30`;
  const startMs = new Date(startIso).getTime();
  const endIso = new Date(startMs + durationMs).toISOString();
  return {
    id,
    title: "Speaking practice",
    category: "Communication",
    module: ENGLISH_MODULE_ID,
    subcategory: "Speaking",
    startTime: new Date(startMs).toISOString(),
    endTime: endIso,
    duration: durationMs,
    date: new Date(startMs).toISOString(),
    intervals: [{ start: new Date(startMs).toISOString(), end: endIso }],
    ...overrides,
  };
}

test("30-minute English session increases global duration by 30m and completes daily goal", () => {
  const historical: TimeEntry = {
    id: "hist-1",
    title: "DSA Arrays",
    category: "DSA",
    startTime: "2026-11-26T08:00:00+05:30",
    endTime: "2026-11-26T09:00:00+05:30",
    duration: 3_600_000,
    date: "2026-11-26T08:00:00+05:30",
  };
  const eng30 = makeEnglishEntry("eng-1", "2026-11-26", 1_800_000);
  const all = [historical, eng30];

  assert.equal(sumDuration(all), 3_600_000 + 1_800_000);
  assert.equal(getEnglishEntries(all).length, 1);

  const metrics = computeEnglishStreakMetrics(
    all,
    {
      dailyGoalMs: DEFAULT_DAILY_ENGLISH_GOAL_MS,
      timezone: TZ,
      goalHistory: [{ effectiveDate: "2026-11-26", goalMs: DEFAULT_DAILY_ENGLISH_GOAL_MS }],
      plannedRestDays: [],
    },
    new Date("2026-11-26T15:00:00+05:30"),
  );

  assert.equal(metrics.todayDurationMs, 1_800_000);
  assert.equal(metrics.todayGoalCompleted, true);
  assert.equal(metrics.currentStreak, 1);
});

test("Two 15-minute sessions complete goal; 29-minute does not; 45-minute gives 1 streak credit", () => {
  const baseSettings = {
    dailyGoalMs: DEFAULT_DAILY_ENGLISH_GOAL_MS,
    timezone: TZ,
    goalHistory: [{ effectiveDate: "2026-11-20", goalMs: DEFAULT_DAILY_ENGLISH_GOAL_MS }],
    plannedRestDays: [] as string[],
  };
  const nowRef = new Date("2026-11-26T20:00:00+05:30");

  const m29 = computeEnglishStreakMetrics(
    [makeEnglishEntry("e29", "2026-11-26", 29 * 60_000)],
    baseSettings,
    nowRef,
  );
  assert.equal(m29.todayGoalCompleted, false);
  assert.equal(m29.currentStreak, 0);

  const m15x2 = computeEnglishStreakMetrics(
    [
      makeEnglishEntry("e15a", "2026-11-26", 15 * 60_000),
      makeEnglishEntry("e15b", "2026-11-26", 15 * 60_000),
    ],
    baseSettings,
    nowRef,
  );
  assert.equal(m15x2.todayDurationMs, 30 * 60_000);
  assert.equal(m15x2.todayGoalCompleted, true);
  assert.equal(m15x2.currentStreak, 1);

  const m45 = computeEnglishStreakMetrics(
    [makeEnglishEntry("e45", "2026-11-26", 45 * 60_000)],
    baseSettings,
    nowRef,
  );
  assert.equal(m45.todayGoalCompleted, true);
  assert.equal(m45.currentStreak, 1);
  assert.equal(m45.totalCompletedDays, 1);
});

test("Paused time is excluded and duplicate session IDs cannot inflate totals", () => {
  const startMs = new Date("2026-11-26T10:00:00Z").getTime();
  const state = pauseActiveTimer(
    {
      entries: [],
      customCategories: [],
      activeTimer: {
        id: "sess-pause",
        title: "Shadowing",
        category: "Communication",
        module: ENGLISH_MODULE_ID,
        subcategory: "Shadowing",
        startTime: new Date(startMs).toISOString(),
        runningSince: new Date(startMs).toISOString(),
        accumulatedMs: 0,
        status: "running",
        intervals: [],
      },
    },
    startMs + 600_000, // ran 10 minutes
  );

  assert.equal(state.activeTimer?.status, "paused");
  assert.equal(state.activeTimer?.accumulatedMs, 600_000);
  assert.equal(state.activeTimer?.intervals?.length, 1);

  const dupA = makeEnglishEntry("dup-1", "2026-11-26", 900_000);
  const dupB = makeEnglishEntry("dup-1", "2026-11-26", 900_000);
  const deduped = deduplicateEntries([dupA, dupB]);
  assert.equal(deduped.length, 1);
  assert.equal(sumDuration(deduped), 900_000);
});

test("Midnight-crossing session allocates duration accurately across calendar dates", () => {
  // 23:45 IST on Dec 31 -> 00:30 IST on Jan 1 (15m on 2026-12-31, 30m on 2027-01-01)
  const startIso = new Date("2026-12-31T23:45:00+05:30").toISOString();
  const endIso = new Date("2027-01-01T00:30:00+05:30").toISOString();
  const crossing: TimeEntry = {
    id: "mid-1",
    title: "Late practice",
    category: "Communication",
    module: ENGLISH_MODULE_ID,
    subcategory: "Reading",
    startTime: startIso,
    endTime: endIso,
    duration: 45 * 60_000,
    date: startIso,
    intervals: [{ start: startIso, end: endIso }],
  };

  const alloc = allocateEntryAcrossDays(crossing, TZ);
  assert.equal(alloc.get("2026-12-31"), 15 * 60_000);
  assert.equal(alloc.get("2027-01-01"), 30 * 60_000);

  // Exact millisecond conservation even when interval sum differs slightly from entry.duration
  const entryWithDrift = makeEnglishEntry("exact-ms", "2026-11-26", 116_432, {
    intervals: [
      {
        start: "2026-11-26T10:00:00.000Z",
        end: "2026-11-26T10:01:56.000Z", // 116_000ms (432ms less than duration)
      },
    ],
  });
  const exactAlloc = allocateEntryAcrossDays(entryWithDrift, TZ);
  const sumAllocated = Array.from(exactAlloc.values()).reduce((a, b) => a + b, 0);
  assert.equal(sumAllocated, 116_432);
});

test("Streak handles month/year boundaries, incomplete today, planned rest days, and effective goal history", () => {
  const entries = [
    makeEnglishEntry("d1", "2026-12-30", 30 * 60_000),
    makeEnglishEntry("d2", "2026-12-31", 30 * 60_000),
    // 2027-01-01 is a planned rest day!
    makeEnglishEntry("d3", "2027-01-02", 30 * 60_000),
    // 2027-01-03 is incomplete (10m)
    makeEnglishEntry("d4", "2027-01-03", 10 * 60_000),
  ];

  // Goal changed to 60m on 2027-01-03; earlier days still use 30m!
  const goalHistory = [
    { effectiveDate: "2026-12-30", goalMs: 30 * 60_000 },
    { effectiveDate: "2027-01-03", goalMs: 60 * 60_000 },
  ];
  assert.equal(getEffectiveGoalForDate("2026-12-31", goalHistory, 60 * 60_000), 30 * 60_000);
  assert.equal(getEffectiveGoalForDate("2027-01-03", goalHistory, 60 * 60_000), 60 * 60_000);

  const metrics = computeEnglishStreakMetrics(
    entries,
    {
      dailyGoalMs: 60 * 60_000,
      timezone: TZ,
      goalHistory,
      plannedRestDays: ["2027-01-01"],
    },
    new Date("2027-01-03T18:00:00+05:30"),
  );

  // Today (Jan 3) is incomplete, so streak remains alive from Jan 2 -> (rest Jan 1) -> Dec 31 -> Dec 30 = 3 completed days!
  assert.equal(metrics.todayGoalCompleted, false);
  assert.equal(metrics.currentStreak, 3);
  assert.equal(metrics.longestStreak, 3);
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
});

test("Spaced repetition, deterministic daily challenges, achievements, and Zod schemas", () => {
  const vocab: VocabularyItem = {
    id: "v1",
    word: "articulate",
    meaning: "able to speak clearly",
    partOfSpeech: "adjective",
    pronunciation: "aar-tik-yuh-lit",
    exampleSentence: "She gave an articulate presentation.",
    personalExample: "",
    synonyms: ["eloquent"],
    antonyms: [],
    tags: ["interview"],
    masteryLevel: "New",
    favorite: true,
    createdAt: "2026-11-20T00:00:00Z",
    updatedAt: "2026-11-20T00:00:00Z",
    reviewCount: 0,
  };

  assert.equal(isItemDue(vocab, Date.now()), true);
  assert.equal(sortRevisionQueue([vocab]).length, 1);

  const good1 = calculateNextReview("New", 0, "Good", 1_700_000_000_000);
  assert.equal(good1.masteryLevel, "Learning");
  assert.equal(good1.reviewCount, 1);
  assert.equal(isItemDue({ ...vocab, ...good1 }, 1_700_000_000_000 + 1000), false);

  const chA = getChallengeForDateKey("2026-11-26");
  const chB = getChallengeForDateKey("2026-11-26");
  assert.equal(chA.id, chB.id);

  assert.equal(vocabularyItemSchema.safeParse(vocab).success, true);
  assert.equal(
    timeEntrySchema.safeParse(makeEnglishEntry("t1", "2026-11-26", 1000)).success,
    true,
  );
  assert.equal(
    englishStateDocSchema.safeParse({
      dailyGoalMs: 1_800_000,
      timezone: TZ,
      goalHistory: [{ effectiveDate: "2026-11-26", goalMs: 1_800_000 }],
      plannedRestDays: [],
      celebratedGoalDates: [],
      challengeRecords: [],
      unlockedAchievements: [],
      animationsEnabled: true,
    }).success,
    true,
  );

  const dummyMetrics = computeEnglishStreakMetrics(
    [makeEnglishEntry("a1", "2026-11-26", 1_800_000)],
    {
      dailyGoalMs: 1_800_000,
      timezone: TZ,
      goalHistory: [{ effectiveDate: "2026-11-26", goalMs: 1_800_000 }],
      plannedRestDays: [],
    },
    new Date("2026-11-26T18:00:00+05:30"),
  );
  const ach = evaluateAchievements(
    {
      streakMetrics: dummyMetrics,
      vocabulary: [vocab],
      phrases: [],
      mistakes: [],
      journals: [],
      challengeRecords: [],
    },
    [],
  );
  assert.equal(ach.newlyUnlocked.some((u) => u.id === "first-step"), true);
});
