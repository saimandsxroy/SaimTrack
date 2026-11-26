import { z } from "zod";
import {
  englishPracticeCategories,
  grammarCategories,
  masteryLevels,
  mistakeStatuses,
  phraseFormalities,
} from "@/features/english-communication/english-types";

export const timerIntervalSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export const timeEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  startTime: z.string(),
  endTime: z.string(),
  duration: z.number().nonnegative(),
  date: z.string(),
  notes: z.string().optional(),
  module: z.string().optional(),
  subcategory: z.string().optional(),
  intervals: z.array(timerIntervalSchema).optional(),
});

export const activeTimerSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  startTime: z.string(),
  runningSince: z.string(),
  accumulatedMs: z.number().nonnegative(),
  status: z.enum(["running", "paused"]),
  notes: z.string().optional(),
  module: z.string().optional(),
  subcategory: z.string().optional(),
  intervals: z.array(timerIntervalSchema).optional(),
});

export const timeTrackerStateSchema = z.object({
  entries: z.array(timeEntrySchema),
  activeTimer: activeTimerSchema.nullable(),
  customCategories: z.array(z.string()).optional(),
});

export const vocabularyItemSchema = z.object({
  id: z.string().min(1),
  word: z.string().trim().min(1, "Word is required."),
  meaning: z.string().trim().min(1, "Meaning is required."),
  hindiMeaning: z.string().optional(),
  partOfSpeech: z.string().min(1),
  pronunciation: z.string().default(""),
  exampleSentence: z.string().default(""),
  personalExample: z.string().default(""),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  masteryLevel: z.enum(masteryLevels),
  favorite: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastReviewedAt: z.string().optional(),
  nextReviewAt: z.string().optional(),
  reviewCount: z.number().int().nonnegative().default(0),
});

export const phraseItemSchema = z.object({
  id: z.string().min(1),
  phrase: z.string().trim().min(1, "Phrase is required."),
  meaning: z.string().trim().min(1, "Meaning is required."),
  example: z.string().default(""),
  context: z.string().min(1),
  formality: z.enum(phraseFormalities),
  tags: z.array(z.string()).default([]),
  favorite: z.boolean().default(false),
  masteryLevel: z.enum(masteryLevels),
  lastReviewedAt: z.string().optional(),
  nextReviewAt: z.string().optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const grammarMistakeSchema = z.object({
  id: z.string().min(1),
  originalSentence: z.string().trim().min(1, "Original sentence is required."),
  correctedSentence: z.string().trim().min(1, "Corrected sentence is required."),
  naturalAlternative: z.string().default(""),
  explanation: z.string().default(""),
  grammarCategory: z.enum(grammarCategories),
  example: z.string().default(""),
  status: z.enum(mistakeStatuses),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const practiceJournalSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2, "Title is required."),
  topic: z.string().default(""),
  date: z.string().min(1),
  linkedSessionId: z.string().optional(),
  practiceCategory: z.enum(englishPracticeCategories),
  whatILearned: z.string().default(""),
  difficulties: z.string().default(""),
  sentencesToImprove: z.string().default(""),
  newExpressions: z.string().default(""),
  externalFeedback: z.string().default(""),
  personalFeedback: z.string().default(""),
  nextPracticeGoal: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const scoreField = z.number().min(1).max(10);

export const communicationAssessmentSchema = z.object({
  id: z.string().min(1),
  assessmentDate: z.string().min(1),
  assessmentSource: z.string().min(1),
  fluency: scoreField,
  grammar: scoreField,
  vocabulary: scoreField,
  pronunciation: scoreField,
  confidence: scoreField,
  clarity: scoreField,
  sentenceFormation: scoreField,
  strengths: z.string().default(""),
  improvementAreas: z.string().default(""),
  feedbackNotes: z.string().default(""),
  nextWeekFocus: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const englishStateDocSchema = z.object({
  dailyGoalMs: z.number().int().min(60_000),
  timezone: z.string().min(1),
  goalHistory: z.array(
    z.object({
      effectiveDate: z.string(),
      goalMs: z.number().int().min(60_000),
    }),
  ),
  plannedRestDays: z.array(z.string()),
  celebratedGoalDates: z.array(z.string()),
  challengeRecords: z.array(
    z.object({
      dateKey: z.string(),
      challengeId: z.string(),
      status: z.enum(["completed", "skipped"]),
      notes: z.string(),
      updatedAt: z.string(),
    }),
  ),
  unlockedAchievements: z.array(
    z.object({
      id: z.string(),
      unlockedAt: z.string(),
    }),
  ),
  animationsEnabled: z.boolean().default(true),
  streakSummary: z
    .object({
      currentStreak: z.number().int().nonnegative(),
      longestStreak: z.number().int().nonnegative(),
      totalCompletedDays: z.number().int().nonnegative(),
      totalActiveDays: z.number().int().nonnegative(),
      todayKey: z.string(),
      todayDurationMs: z.number().nonnegative(),
      todayGoalMs: z.number().nonnegative(),
      todayGoalCompleted: z.boolean(),
      lastCalculatedAt: z.string(),
    })
    .optional(),
  updatedAt: z.string().optional(),
});

export const englishVocabularyDocSchema = z.object({
  items: z.array(vocabularyItemSchema),
  updatedAt: z.string().optional(),
});

export const englishPhrasesDocSchema = z.object({
  items: z.array(phraseItemSchema),
  updatedAt: z.string().optional(),
});

export const englishMistakesDocSchema = z.object({
  items: z.array(grammarMistakeSchema),
  updatedAt: z.string().optional(),
});

export const englishPracticeJournalDocSchema = z.object({
  journals: z.array(practiceJournalSchema),
  assessments: z.array(communicationAssessmentSchema),
  updatedAt: z.string().optional(),
});
