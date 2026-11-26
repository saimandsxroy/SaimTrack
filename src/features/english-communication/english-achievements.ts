import type { EnglishStreakMetrics } from "@/features/english-communication/english-streak";
import type {
  ChallengeCompletionRecord,
  GrammarMistakeItem,
  PhraseItem,
  PracticeJournalEntry,
  UnlockedAchievement,
  VocabularyItem,
} from "@/features/english-communication/english-types";

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  iconName:
    | "Footprints"
    | "Flame"
    | "CalendarCheck2"
    | "BookMarked"
    | "Crown"
    | "CheckCheck"
    | "NotebookPen"
    | "Trophy"
    | "Sparkles"
    | "Clock3";
  target: number;
  unit: string;
  evaluateProgress: (ctx: AchievementContext) => number;
};

export type AchievementContext = {
  streakMetrics: EnglishStreakMetrics;
  vocabulary: VocabularyItem[];
  phrases: PhraseItem[];
  mistakes: GrammarMistakeItem[];
  journals: PracticeJournalEntry[];
  challengeRecords: ChallengeCompletionRecord[];
};

export type EvaluatedAchievement = AchievementDefinition & {
  current: number;
  progressPercent: number;
  unlocked: boolean;
  unlockedAt?: string;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "first-step",
    title: "First Step",
    description: "Complete and save your first English practice session.",
    iconName: "Footprints",
    target: 1,
    unit: "sessions",
    evaluateProgress: (ctx) => ctx.streakMetrics.totalSessionsCount,
  },
  {
    id: "on-fire",
    title: "On Fire",
    description: "Maintain a 7-day English daily goal streak.",
    iconName: "Flame",
    target: 7,
    unit: "days",
    evaluateProgress: (ctx) => ctx.streakMetrics.longestStreak,
  },
  {
    id: "consistency",
    title: "Consistency",
    description: "Complete 30 daily English practice goals.",
    iconName: "CalendarCheck2",
    target: 30,
    unit: "goals",
    evaluateProgress: (ctx) => ctx.streakMetrics.totalCompletedDays,
  },
  {
    id: "word-collector",
    title: "Word Collector",
    description: "Save 100 words in your Vocabulary Vault.",
    iconName: "BookMarked",
    target: 100,
    unit: "words",
    evaluateProgress: (ctx) => ctx.vocabulary.length,
  },
  {
    id: "vocabulary-master",
    title: "Vocabulary Master",
    description: "Reach Mastered status on 50 vocabulary words.",
    iconName: "Crown",
    target: 50,
    unit: "mastered",
    evaluateProgress: (ctx) =>
      ctx.vocabulary.filter((item) => item.masteryLevel === "Mastered").length,
  },
  {
    id: "grammar-explorer",
    title: "Grammar Explorer",
    description: "Resolve 25 logged items in your Grammar Mistake Journal.",
    iconName: "CheckCheck",
    target: 25,
    unit: "resolved",
    evaluateProgress: (ctx) =>
      ctx.mistakes.filter((item) => item.status === "Resolved").length,
  },
  {
    id: "communication-explorer",
    title: "Communication Explorer",
    description: "Write 10 speaking practice journal reflections.",
    iconName: "NotebookPen",
    target: 10,
    unit: "entries",
    evaluateProgress: (ctx) => ctx.journals.length,
  },
  {
    id: "challenge-champion",
    title: "Challenge Champion",
    description: "Complete 10 daily speaking challenges.",
    iconName: "Trophy",
    target: 10,
    unit: "challenges",
    evaluateProgress: (ctx) =>
      ctx.challengeRecords.filter((rec) => rec.status === "completed").length,
  },
  {
    id: "phrase-builder",
    title: "Phrase Architect",
    description: "Collect 25 natural phrases and expressions.",
    iconName: "Sparkles",
    target: 25,
    unit: "phrases",
    evaluateProgress: (ctx) => ctx.phrases.length,
  },
  {
    id: "deep-communicator",
    title: "10-Hour Communicator",
    description: "Log 10 cumulative hours of focused English practice.",
    iconName: "Clock3",
    target: 10,
    unit: "hours",
    evaluateProgress: (ctx) =>
      Math.floor(ctx.streakMetrics.lifetimeDurationMs / 3_600_000),
  },
];

/**
 * Evaluates all achievements against current data and identifies any newly unlocked ones
 * without duplicating existing unlocked records.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  existingUnlocked: UnlockedAchievement[],
  nowIso = new Date().toISOString(),
): {
  items: EvaluatedAchievement[];
  newlyUnlocked: UnlockedAchievement[];
  mergedUnlocked: UnlockedAchievement[];
} {
  const unlockedMap = new Map<string, UnlockedAchievement>();
  for (const item of existingUnlocked) {
    if (!unlockedMap.has(item.id)) {
      unlockedMap.set(item.id, item);
    }
  }

  const newlyUnlocked: UnlockedAchievement[] = [];
  const items: EvaluatedAchievement[] = ACHIEVEMENT_DEFINITIONS.map((def) => {
    const current = Math.max(0, def.evaluateProgress(ctx));
    const progressPercent = Math.min(100, Math.round((current / def.target) * 100));
    const existing = unlockedMap.get(def.id);
    const meetsTarget = current >= def.target;

    let unlockedAt = existing?.unlockedAt;
    if (meetsTarget && !existing) {
      const created: UnlockedAchievement = { id: def.id, unlockedAt: nowIso };
      unlockedMap.set(def.id, created);
      newlyUnlocked.push(created);
      unlockedAt = nowIso;
    }

    return {
      ...def,
      current,
      progressPercent,
      unlocked: Boolean(existing || meetsTarget),
      unlockedAt,
    };
  });

  return {
    items,
    newlyUnlocked,
    mergedUnlocked: Array.from(unlockedMap.values()),
  };
}
