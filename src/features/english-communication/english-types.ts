export const ENGLISH_MODULE_ID = "english-communication" as const;
export const DEFAULT_DAILY_ENGLISH_GOAL_MS = 1_800_000; // 30 minutes

export const englishPracticeCategories = [
  "Speaking",
  "Listening",
  "Vocabulary",
  "Grammar",
  "Pronunciation",
  "Reading",
  "Writing",
  "Shadowing",
  "Interview preparation",
  "Technical communication",
  "Professional communication",
  "General conversation",
] as const;

export type EnglishPracticeCategory = (typeof englishPracticeCategories)[number];

export type EnglishTabId =
  | "overview"
  | "practice"
  | "vocabulary"
  | "phrases"
  | "mistakes"
  | "practice-journal"
  | "analytics"
  | "achievements";

export const englishTabs: { id: EnglishTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "practice", label: "Practice" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "phrases", label: "Phrases" },
  { id: "mistakes", label: "Mistakes" },
  { id: "practice-journal", label: "Practice Journal" },
  { id: "analytics", label: "Analytics" },
  { id: "achievements", label: "Achievements" },
];

export const masteryLevels = ["New", "Learning", "Familiar", "Mastered"] as const;
export type MasteryLevel = (typeof masteryLevels)[number];

export const partsOfSpeech = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "idiom",
  "phrasal verb",
  "other",
] as const;
export type PartOfSpeech = (typeof partsOfSpeech)[number];

export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type VocabularyItem = {
  id: string;
  word: string;
  meaning: string;
  hindiMeaning?: string;
  partOfSpeech: PartOfSpeech | string;
  pronunciation: string;
  exampleSentence: string;
  personalExample: string;
  synonyms: string[];
  antonyms: string[];
  tags: string[];
  masteryLevel: MasteryLevel;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
};

export const phraseCategories = [
  "Interview communication",
  "Client meetings",
  "Daily conversation",
  "Technical communication",
  "Professional communication",
  "American English expressions",
  "Presentations",
] as const;
export type PhraseCategory = (typeof phraseCategories)[number];

export const phraseFormalities = ["Casual", "Neutral", "Professional", "Formal"] as const;
export type PhraseFormality = (typeof phraseFormalities)[number];

export type PhraseItem = {
  id: string;
  phrase: string;
  meaning: string;
  example: string;
  context: PhraseCategory | string;
  formality: PhraseFormality;
  tags: string[];
  favorite: boolean;
  masteryLevel: MasteryLevel;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
};

export const grammarCategories = [
  "Tenses",
  "Prepositions",
  "Articles",
  "Sentence formation",
  "Subject-verb agreement",
  "Vocabulary usage",
  "Word order",
  "Other",
] as const;
export type GrammarCategory = (typeof grammarCategories)[number];

export const mistakeStatuses = ["Needs revision", "Practicing", "Resolved"] as const;
export type MistakeStatus = (typeof mistakeStatuses)[number];

export type GrammarMistakeItem = {
  id: string;
  originalSentence: string;
  correctedSentence: string;
  naturalAlternative: string;
  explanation: string;
  grammarCategory: GrammarCategory;
  example: string;
  status: MistakeStatus;
  createdAt: string;
  updatedAt: string;
};

export type PracticeJournalEntry = {
  id: string;
  title: string;
  topic: string;
  date: string; // YYYY-MM-DD
  linkedSessionId?: string;
  practiceCategory: EnglishPracticeCategory;
  whatILearned: string;
  difficulties: string;
  sentencesToImprove: string;
  newExpressions: string;
  externalFeedback: string;
  personalFeedback: string;
  nextPracticeGoal: string;
  createdAt: string;
  updatedAt: string;
};

export const assessmentSources = [
  "Self-assessment",
  "Teacher / Tutor",
  "Mentor",
  "External Feedback (e.g. ChatGPT)",
  "Peer Review",
] as const;
export type AssessmentSource = (typeof assessmentSources)[number];

export type CommunicationAssessment = {
  id: string;
  assessmentDate: string; // YYYY-MM-DD
  assessmentSource: AssessmentSource | string;
  fluency: number;
  grammar: number;
  vocabulary: number;
  pronunciation: number;
  confidence: number;
  clarity: number;
  sentenceFormation: number;
  strengths: string;
  improvementAreas: string;
  feedbackNotes: string;
  nextWeekFocus: string;
  createdAt: string;
  updatedAt: string;
};

export type DailySpeakingChallenge = {
  id: string;
  title: string;
  prompt: string;
  category: EnglishPracticeCategory;
  estimatedMinutes: number;
  tips: string[];
};

export type ChallengeCompletionRecord = {
  dateKey: string; // YYYY-MM-DD
  challengeId: string;
  status: "completed" | "skipped";
  notes: string;
  updatedAt: string;
};

export type UnlockedAchievement = {
  id: string;
  unlockedAt: string;
};

export type GoalHistoryEntry = {
  effectiveDate: string; // YYYY-MM-DD in configured timezone
  goalMs: number;
};

export type EnglishStreakSummary = {
  currentStreak: number;
  longestStreak: number;
  totalCompletedDays: number;
  totalActiveDays: number;
  todayKey: string;
  todayDurationMs: number;
  todayGoalMs: number;
  todayGoalCompleted: boolean;
  lastCalculatedAt: string;
};

export type EnglishCommunicationStateDoc = {
  dailyGoalMs: number;
  timezone: string;
  goalHistory: GoalHistoryEntry[];
  plannedRestDays: string[]; // YYYY-MM-DD
  celebratedGoalDates: string[]; // YYYY-MM-DD
  challengeRecords: ChallengeCompletionRecord[];
  unlockedAchievements: UnlockedAchievement[];
  animationsEnabled: boolean;
  streakSummary?: EnglishStreakSummary;
  updatedAt?: string;
};

export type EnglishVocabularyDoc = {
  items: VocabularyItem[];
  updatedAt?: string;
};

export type EnglishPhrasesDoc = {
  items: PhraseItem[];
  updatedAt?: string;
};

export type EnglishMistakesDoc = {
  items: GrammarMistakeItem[];
  updatedAt?: string;
};

export type EnglishPracticeJournalDoc = {
  journals: PracticeJournalEntry[];
  assessments: CommunicationAssessment[];
  updatedAt?: string;
};
