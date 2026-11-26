"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Languages, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { useTimeTracker } from "@/features/time-tracker/time-tracker-context";
import type { TimeEntry } from "@/features/time-tracker/time-tracker-types";
import { evaluateAchievements } from "@/features/english-communication/english-achievements";
import { getChallengeForDateKey } from "@/features/english-communication/english-challenges";
import {
  createDefaultEnglishState,
  defaultMistakesDoc,
  defaultPhrasesDoc,
  defaultPracticeJournalDoc,
  defaultVocabularyDoc,
  getDocumentSizeStatus,
  loadAllEnglishData,
  saveEnglishMistakes,
  saveEnglishPhrases,
  saveEnglishPracticeJournal,
  saveEnglishState,
  saveEnglishVocabulary,
} from "@/features/english-communication/english-storage";
import { computeEnglishStreakMetrics } from "@/features/english-communication/english-streak";
import {
  englishTabs,
  type CommunicationAssessment,
  type EnglishCommunicationStateDoc,
  type EnglishMistakesDoc,
  type EnglishPhrasesDoc,
  type EnglishPracticeJournalDoc,
  type EnglishTabId,
  type EnglishVocabularyDoc,
  type GrammarMistakeItem,
  type PhraseItem,
  type PracticeJournalEntry,
  type VocabularyItem,
} from "@/features/english-communication/english-types";

import { AchievementsTab } from "@/features/english-communication/components/achievements-tab";
import { AnalyticsTab } from "@/features/english-communication/components/analytics-tab";
import { JournalTab } from "@/features/english-communication/components/journal-tab";
import { MistakesTab } from "@/features/english-communication/components/mistakes-tab";
import { OverviewTab } from "@/features/english-communication/components/overview-tab";
import { PhrasesTab } from "@/features/english-communication/components/phrases-tab";
import { PracticeTab } from "@/features/english-communication/components/practice-tab";
import { StreakCelebration } from "@/features/english-communication/components/streak-celebration";
import { VocabularyTab } from "@/features/english-communication/components/vocabulary-tab";

export function EnglishCommunicationClient() {
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();
  const {
    hydrated: timerHydrated,
    entries: allTimeEntries,
    activeTimer,
    customCategories,
    syncStatus,
    pendingCount,
    retrySync,
  } = useTimeTracker();

  const [englishHydrated, setEnglishHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<EnglishTabId>("overview");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [settings, setSettings] = useState<EnglishCommunicationStateDoc>(() =>
    createDefaultEnglishState(),
  );
  const [vocabDoc, setVocabDoc] = useState<EnglishVocabularyDoc>(defaultVocabularyDoc);
  const [phrasesDoc, setPhrasesDoc] = useState<EnglishPhrasesDoc>(defaultPhrasesDoc);
  const [mistakesDoc, setMistakesDoc] = useState<EnglishMistakesDoc>(defaultMistakesDoc);
  const [journalDoc, setJournalDoc] = useState<EnglishPracticeJournalDoc>(defaultPracticeJournalDoc);

  const [showCelebration, setShowCelebration] = useState(false);
  const [englishSyncError, setEnglishSyncError] = useState<string | null>(null);
  const [stateNeedsRemoteInit, setStateNeedsRemoteInit] = useState(false);
  const celebrationTriggeredRef = useRef<Set<string>>(new Set());
  const lastSyncedStreakHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function init() {
      const data = await loadAllEnglishData(user!.uid);
      if (!active) return;
      setSettings(data.state);
      setStateNeedsRemoteInit(!data.stateExistsRemote);
      if (data.state.streakSummary) {
        const s = data.state.streakSummary;
        lastSyncedStreakHashRef.current = `${s.currentStreak}:${s.longestStreak}:${s.totalCompletedDays}:${s.totalActiveDays}:${s.todayKey}:${s.todayDurationMs}:${s.todayGoalMs}:${s.todayGoalCompleted}`;
      }
      setVocabDoc(data.vocabulary);
      setPhrasesDoc(data.phrases);
      setMistakesDoc(data.mistakes);
      setJournalDoc(data.practiceJournal);
      setEnglishHydrated(true);
    }
    void init();
    return () => {
      active = false;
    };
  }, [user]);

  const metrics = useMemo(
    () => computeEnglishStreakMetrics(allTimeEntries, settings),
    [allTimeEntries, settings],
  );

  // Sync achievement unlocks whenever underlying data changes
  const achievementEval = useMemo(
    () =>
      evaluateAchievements(
        {
          streakMetrics: metrics,
          vocabulary: vocabDoc.items,
          phrases: phrasesDoc.items,
          mistakes: mistakesDoc.items,
          journals: journalDoc.journals,
          challengeRecords: settings.challengeRecords,
        },
        settings.unlockedAchievements,
      ),
    [
      metrics,
      vocabDoc.items,
      phrasesDoc.items,
      mistakesDoc.items,
      journalDoc.journals,
      settings.challengeRecords,
      settings.unlockedAchievements,
    ],
  );

  useEffect(() => {
    if (!user || !englishHydrated || !timerHydrated) return;
    if (achievementEval.newlyUnlocked.length > 0) {
      const nextSettings: EnglishCommunicationStateDoc = {
        ...settings,
        unlockedAchievements: achievementEval.mergedUnlocked,
      };
      setSettings(nextSettings);
      void saveEnglishState(user.uid, nextSettings);
      for (const unlocked of achievementEval.newlyUnlocked) {
        const def = achievementEval.items.find((i) => i.id === unlocked.id);
        if (def) {
          toast.success(`Achievement Unlocked: ${def.title}!`);
        }
      }
    }
  }, [achievementEval.newlyUnlocked, user, englishHydrated, timerHydrated]);

  const persistSettings = useCallback(
    async (next: EnglishCommunicationStateDoc) => {
      setSettings(next);
      if (user) {
        const res = await saveEnglishState(user.uid, next);
        if (!res.savedRemote && res.error) {
          setEnglishSyncError(res.error);
          toast.error(`Cloud sync error: ${res.error}`);
        } else if (res.savedRemote) {
          setEnglishSyncError(null);
          setStateNeedsRemoteInit(false);
        }
      }
    },
    [user],
  );

  // Sync derived streakSummary & initial settings to Firestore whenever authoritative session totals or goal settings change
  useEffect(() => {
    if (!user || !englishHydrated || !timerHydrated) return;

    const hash = `${metrics.currentStreak}:${metrics.longestStreak}:${metrics.totalCompletedDays}:${metrics.totalActiveDays}:${metrics.todayKey}:${metrics.todayDurationMs}:${metrics.todayGoalMs}:${metrics.todayGoalCompleted}`;
    if (!stateNeedsRemoteInit && lastSyncedStreakHashRef.current === hash) return;

    lastSyncedStreakHashRef.current = hash;
    const nextWithSummary: EnglishCommunicationStateDoc = {
      ...settings,
      unlockedAchievements: achievementEval.mergedUnlocked,
      streakSummary: {
        currentStreak: metrics.currentStreak,
        longestStreak: metrics.longestStreak,
        totalCompletedDays: metrics.totalCompletedDays,
        totalActiveDays: metrics.totalActiveDays,
        todayKey: metrics.todayKey,
        todayDurationMs: metrics.todayDurationMs,
        todayGoalMs: metrics.todayGoalMs,
        todayGoalCompleted: metrics.todayGoalCompleted,
        lastCalculatedAt: new Date().toISOString(),
      },
    };
    void persistSettings(nextWithSummary);
  }, [
    user,
    englishHydrated,
    timerHydrated,
    stateNeedsRemoteInit,
    metrics.currentStreak,
    metrics.longestStreak,
    metrics.totalCompletedDays,
    metrics.totalActiveDays,
    metrics.todayKey,
    metrics.todayDurationMs,
    metrics.todayGoalMs,
    metrics.todayGoalCompleted,
    settings,
    achievementEval.mergedUnlocked,
    persistSettings,
  ]);

  const handleSessionSaved = useCallback(
    (savedEntry: TimeEntry) => {
      // Recompute metrics including the newly saved entry to check if today's goal just completed
      const combined = [
        savedEntry,
        ...allTimeEntries.filter((e) => e.id !== savedEntry.id),
      ];
      const nextMetrics = computeEnglishStreakMetrics(combined, settings);
      const todayKey = nextMetrics.todayKey;

      const alreadyCelebrated =
        settings.celebratedGoalDates.includes(todayKey) ||
        celebrationTriggeredRef.current.has(todayKey);

      if (nextMetrics.todayGoalCompleted && !alreadyCelebrated) {
        celebrationTriggeredRef.current.add(todayKey);
        const goalMins = Math.round(nextMetrics.todayGoalMs / 60_000);
        setShowCelebration(true);
        toast.success(`Daily English goal completed! ${goalMins} minutes of practice saved.`);
        void persistSettings({
          ...settings,
          celebratedGoalDates: Array.from(new Set([...settings.celebratedGoalDates, todayKey])),
        });
      }
    },
    [allTimeEntries, settings, persistSettings],
  );

  const handleToggleRestDay = useCallback(
    (dateKey: string) => {
      const exists = settings.plannedRestDays.includes(dateKey);
      const nextRest = exists
        ? settings.plannedRestDays.filter((d) => d !== dateKey)
        : [...settings.plannedRestDays, dateKey];
      void persistSettings({ ...settings, plannedRestDays: nextRest });
      toast.message(exists ? `Removed rest day (${dateKey}).` : `Marked ${dateKey} as planned rest day.`);
    },
    [settings, persistSettings],
  );

  const handleUpdateChallenge = useCallback(
    (status: "completed" | "skipped", notes: string) => {
      const todayChallenge = getChallengeForDateKey(metrics.todayKey);
      const filtered = settings.challengeRecords.filter(
        (r) => !(r.dateKey === metrics.todayKey && r.challengeId === todayChallenge.id),
      );
      void persistSettings({
        ...settings,
        challengeRecords: [
          ...filtered,
          {
            dateKey: metrics.todayKey,
            challengeId: todayChallenge.id,
            status,
            notes: notes.trim(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      toast.success(
        status === "completed" ? "Daily speaking challenge completed!" : "Challenge skipped for today.",
      );
    },
    [metrics.todayKey, settings, persistSettings],
  );

  const handleNavigateTab = useCallback((tab: EnglishTabId, action?: string) => {
    setActiveTab(tab);
    if (action) setPendingAction(action);
  }, []);

  const handleSaveVocab = useCallback(
    async (items: VocabularyItem[]) => {
      const next = { items };
      setVocabDoc(next);
      if (user) {
        const res = await saveEnglishVocabulary(user.uid, next);
        if (res.nearLimit) {
          toast.warning("Vocabulary document is approaching Firestore's 1 MiB limit.");
        }
        if (!res.savedRemote && res.error) {
          setEnglishSyncError(res.error);
          toast.error(`Vocabulary sync error: ${res.error}`);
        } else if (res.savedRemote) {
          setEnglishSyncError(null);
        }
      }
    },
    [user],
  );

  const handleSavePhrases = useCallback(
    async (items: PhraseItem[]) => {
      const next = { items };
      setPhrasesDoc(next);
      if (user) {
        const res = await saveEnglishPhrases(user.uid, next);
        if (!res.savedRemote && res.error) {
          setEnglishSyncError(res.error);
          toast.error(`Phrases sync error: ${res.error}`);
        } else if (res.savedRemote) {
          setEnglishSyncError(null);
        }
      }
    },
    [user],
  );

  const handleSaveMistakes = useCallback(
    async (items: GrammarMistakeItem[]) => {
      const next = { items };
      setMistakesDoc(next);
      if (user) {
        const res = await saveEnglishMistakes(user.uid, next);
        if (!res.savedRemote && res.error) {
          setEnglishSyncError(res.error);
          toast.error(`Mistakes sync error: ${res.error}`);
        } else if (res.savedRemote) {
          setEnglishSyncError(null);
        }
      }
    },
    [user],
  );

  const handleSaveJournalAndAssessments = useCallback(
    async (journals: PracticeJournalEntry[], assessments: CommunicationAssessment[]) => {
      const next = { journals, assessments };
      setJournalDoc(next);
      if (user) {
        const res = await saveEnglishPracticeJournal(user.uid, next);
        if (!res.savedRemote && res.error) {
          setEnglishSyncError(res.error);
          toast.error(`Journal sync error: ${res.error}`);
        } else if (res.savedRemote) {
          setEnglishSyncError(null);
        }
      }
    },
    [user],
  );

  const docSizes = useMemo(
    () => [
      getDocumentSizeStatus("time-tracker/state", {
        entries: allTimeEntries,
        activeTimer,
        customCategories,
      }),
      getDocumentSizeStatus("english-communication/state", settings),
      getDocumentSizeStatus("english-communication/vocabulary", vocabDoc),
      getDocumentSizeStatus("english-communication/phrases", phrasesDoc),
      getDocumentSizeStatus("english-communication/mistakes", mistakesDoc),
      getDocumentSizeStatus("english-communication/practice-journal", journalDoc),
    ],
    [allTimeEntries, activeTimer, customCategories, settings, vocabDoc, phrasesDoc, mistakesDoc, journalDoc],
  );

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveTab(englishTabs[(idx + 1) % englishTabs.length].id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveTab(englishTabs[(idx - 1 + englishTabs.length) % englishTabs.length].id);
    }
  };

  if (!englishHydrated || !timerHydrated) {
    return (
      <div className="flex flex-col gap-6 pb-16">
        <div className="h-10 w-64 bg-surface animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface animate-pulse rounded-xl border border-border" />
          ))}
        </div>
        <div className="h-[260px] w-full bg-surface animate-pulse rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <Languages className="h-6 w-6 text-accent" />
            <h1 className="text-[28px] font-medium tracking-tight text-text-primary">
              English Communication
            </h1>
          </div>
          <p className="mt-1 text-[15px] text-text-secondary">
            Daily fluency practice, vocabulary spaced repetition, and communication tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void retrySync()}
            className={`h-8 px-3 rounded-md border bg-surface text-[12px] flex items-center gap-1.5 transition-colors ${
              englishSyncError || syncStatus === "error"
                ? "border-destructive/50 text-destructive"
                : "border-border text-text-secondary hover:text-text-primary"
            }`}
            title={englishSyncError || "Cloud Firestore sync status"}
          >
            <RefreshCw className={`h-3 w-3 ${syncStatus === "syncing" ? "animate-spin text-accent" : ""}`} />
            {englishSyncError
              ? "Sync Error"
              : syncStatus === "synced"
                ? "Synced"
                : syncStatus === "offline"
                  ? `Offline${pendingCount > 0 ? ` (${pendingCount})` : ""}`
                  : syncStatus === "pending"
                    ? `Pending (${pendingCount})`
                    : syncStatus === "syncing"
                      ? "Syncing..."
                      : "Sync Retry"}
          </button>
        </div>
      </motion.div>

      {/* Once-per-day Animated Goal Completion Banner */}
      <StreakCelebration
        visible={showCelebration}
        streakCount={metrics.currentStreak}
        goalMinutes={Math.round(metrics.todayGoalMs / 60_000)}
        animationsEnabled={settings.animationsEnabled}
        onDismiss={() => setShowCelebration(false)}
      />

      {/* Accessible Internal Tabs */}
      <div
        role="tablist"
        aria-label="English Communication sections"
        className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-2"
      >
        {englishTabs.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`relative h-9 px-3.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "text-text-primary bg-surface-raised border border-border"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
              }`}
            >
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="english-tab-underline"
                  className="absolute inset-x-2 -bottom-[9px] h-[2px] bg-accent rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          role="tabpanel"
        >
          {activeTab === "overview" && (
            <OverviewTab
              metrics={metrics}
              settings={settings}
              allEntries={allTimeEntries}
              vocabulary={vocabDoc.items}
              achievements={achievementEval.items}
              onNavigateTab={handleNavigateTab}
              onToggleRestDay={handleToggleRestDay}
              onUpdateChallenge={handleUpdateChallenge}
              onSessionSaved={handleSessionSaved}
            />
          )}

          {activeTab === "practice" && (
            <PracticeTab onSessionSaved={handleSessionSaved} />
          )}

          {activeTab === "vocabulary" && (
            <VocabularyTab
              items={vocabDoc.items}
              onSave={handleSaveVocab}
              initialAction={pendingAction}
              onActionHandled={() => setPendingAction(null)}
            />
          )}

          {activeTab === "phrases" && (
            <PhrasesTab
              items={phrasesDoc.items}
              onSave={handleSavePhrases}
              initialAction={pendingAction}
              onActionHandled={() => setPendingAction(null)}
            />
          )}

          {activeTab === "mistakes" && (
            <MistakesTab
              items={mistakesDoc.items}
              onSave={handleSaveMistakes}
              initialAction={pendingAction}
              onActionHandled={() => setPendingAction(null)}
            />
          )}

          {activeTab === "practice-journal" && (
            <JournalTab
              journals={journalDoc.journals}
              assessments={journalDoc.assessments}
              allEntries={allTimeEntries}
              onSave={handleSaveJournalAndAssessments}
              initialAction={pendingAction}
              onActionHandled={() => setPendingAction(null)}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsTab
              allEntries={allTimeEntries}
              metrics={metrics}
              timezone={settings.timezone}
              vocabulary={vocabDoc.items}
              mistakes={mistakesDoc.items}
              assessments={journalDoc.assessments}
            />
          )}

          {activeTab === "achievements" && (
            <AchievementsTab
              achievements={achievementEval.items}
              settings={settings}
              todayKey={metrics.todayKey}
              docSizes={docSizes}
              onSaveSettings={persistSettings}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
