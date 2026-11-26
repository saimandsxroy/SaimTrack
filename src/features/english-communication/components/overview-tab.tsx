"use client";

import { useMemo, useState } from "react";
import {
  BookMarked,
  BookOpen,
  CalendarCheck2,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Crown,
  Flame,
  Footprints,
  Layers,
  Lock,
  MessageSquareQuote,
  NotebookPen,
  Play,
  SkipForward,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import dynamic from "next/dynamic";

import { ContributionHeatmap } from "@/features/english-communication/components/contribution-heatmap";
import { PracticeTab } from "@/features/english-communication/components/practice-tab";
import type { EvaluatedAchievement } from "@/features/english-communication/english-achievements";
import { getChallengeForDateKey } from "@/features/english-communication/english-challenges";
import { isItemDue } from "@/features/english-communication/english-srs";
import {
  addDaysToDateKey,
  getEnglishEntries,
  type EnglishStreakMetrics,
} from "@/features/english-communication/english-streak";
import type {
  EnglishCommunicationStateDoc,
  EnglishPracticeCategory,
  EnglishTabId,
  VocabularyItem,
} from "@/features/english-communication/english-types";
import { useTimeTracker } from "@/features/time-tracker/time-tracker-context";
import type { TimeEntry, TimeTrackerPeriod } from "@/features/time-tracker/time-tracker-types";
import {
  formatDate,
  formatDuration,
  formatTime,
  periodLabel,
} from "@/features/time-tracker/time-tracker-utils";

const ChartCard = dynamic(
  () => import("@/features/time-tracker/time-charts").then((mod) => mod.ChartCard),
  {
    ssr: false,
    loading: () => (
      <div className="h-[212px] animate-pulse bg-surface-raised rounded-lg border border-border" />
    ),
  },
);

const ACHIEVEMENT_ICONS = {
  Footprints,
  Flame,
  CalendarCheck2,
  BookMarked,
  Crown,
  CheckCheck,
  NotebookPen,
  Trophy,
  Sparkles,
  Clock3,
} as const;

const periodOptions: TimeTrackerPeriod[] = ["today", "week", "month", "year", "lifetime"];

type OverviewTabProps = {
  metrics: EnglishStreakMetrics;
  settings: EnglishCommunicationStateDoc;
  allEntries: TimeEntry[];
  vocabulary: VocabularyItem[];
  achievements: EvaluatedAchievement[];
  onNavigateTab: (tab: EnglishTabId, action?: string) => void;
  onToggleRestDay: (dateKey: string) => void;
  onUpdateChallenge: (status: "completed" | "skipped", notes: string) => void;
  onSessionSaved: (entry: TimeEntry) => void;
};

export function OverviewTab({
  metrics,
  settings,
  allEntries,
  vocabulary,
  achievements,
  onNavigateTab,
  onToggleRestDay,
  onUpdateChallenge,
  onSessionSaved,
}: OverviewTabProps) {
  const { deleteEntry } = useTimeTracker();
  const [selectedPeriod, setSelectedPeriod] = useState<TimeTrackerPeriod>("today");
  const [challengeNotes, setChallengeNotes] = useState("");
  const [timerPrefill, setTimerPrefill] = useState<{
    title?: string;
    category?: EnglishPracticeCategory;
  }>({});

  const englishEntries = useMemo(() => getEnglishEntries(allEntries), [allEntries]);

  const vocabStats = useMemo(() => {
    const nowMs = Date.now();
    return {
      total: vocabulary.length,
      due: vocabulary.filter((v) => isItemDue(v, nowMs)).length,
    };
  }, [vocabulary]);

  const unlockedCount = useMemo(
    () => achievements.filter((a) => a.unlocked).length,
    [achievements],
  );

  // Exact period metrics anchored to metrics.todayKey & metrics.dailyMap (never drifts across midnight/timezones)
  const periodStats = useMemo(() => {
    const todayKey = metrics.todayKey;
    const [ty, tm, td] = todayKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0)).getUTCDay() || 7;
    const weekStartKey = addDaysToDateKey(todayKey, -(weekday - 1));
    const monthStartKey = `${todayKey.slice(0, 7)}-01`;
    const yearStartKey = `${todayKey.slice(0, 4)}-01-01`;

    let totalMs = 0;
    const seenSessionIds = new Set<string>();
    const categoryTotals = new Map<string, number>();

    if (selectedPeriod === "lifetime") {
      totalMs = metrics.lifetimeDurationMs;
      for (const e of englishEntries) {
        seenSessionIds.add(e.id);
        const cat = e.subcategory || e.category || "Communication";
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + e.duration);
      }
    } else {
      const startKey =
        selectedPeriod === "today"
          ? todayKey
          : selectedPeriod === "week"
            ? weekStartKey
            : selectedPeriod === "month"
              ? monthStartKey
              : yearStartKey;

      for (const [key, summary] of metrics.dailyMap.entries()) {
        if (key >= startKey && key <= todayKey) {
          totalMs += summary.durationMs;
          for (const s of summary.sessions) {
            if (!seenSessionIds.has(s.id)) {
              seenSessionIds.add(s.id);
              const cat = s.subcategory || s.category || "Communication";
              categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + s.duration);
            }
          }
        }
      }
    }

    const sessionCount = seenSessionIds.size;
    const avgMs = sessionCount > 0 ? totalMs / sessionCount : 0;
    const distribution = Array.from(categoryTotals.entries()).map(([name, ms]) => ({
      name,
      value: Number((ms / 3_600_000).toFixed(2)),
    }));

    return { totalMs, avgMs, sessionCount, distribution };
  }, [selectedPeriod, metrics, englishEntries]);

  const dailySeries = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysToDateKey(metrics.todayKey, -(6 - i));
      const [y, m, d] = key.split("-").map(Number);
      const label = new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
        new Date(Date.UTC(y, m - 1, d, 12, 0, 0)),
      );
      return {
        name: label,
        hours: Number(((metrics.dailyMap.get(key)?.durationMs ?? 0) / 3_600_000).toFixed(2)),
      };
    });
  }, [metrics.todayKey, metrics.dailyMap]);

  const weeklySeries = useMemo(() => {
    const [ty, tm, td] = metrics.todayKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0)).getUTCDay() || 7;
    const thisMonday = addDaysToDateKey(metrics.todayKey, -(weekday - 1));

    return Array.from({ length: 6 }, (_, wIdx) => {
      const weekStart = addDaysToDateKey(thisMonday, -(5 - wIdx) * 7);
      const weekEnd = addDaysToDateKey(weekStart, 6);
      let ms = 0;
      for (const [k, sum] of metrics.dailyMap.entries()) {
        if (k >= weekStart && k <= weekEnd) ms += sum.durationMs;
      }
      return { name: `W${wIdx + 1}`, hours: Number((ms / 3_600_000).toFixed(2)) };
    });
  }, [metrics.todayKey, metrics.dailyMap]);

  const monthlySeries = useMemo(() => {
    const [curYear, curMonth] = metrics.todayKey.split("-").map(Number);
    return Array.from({ length: 12 }, (_, idx) => {
      const dt = new Date(Date.UTC(curYear, curMonth - 1 - (11 - idx), 1, 12, 0, 0));
      const ym = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      let ms = 0;
      for (const [k, sum] of metrics.dailyMap.entries()) {
        if (k.startsWith(ym)) ms += sum.durationMs;
      }
      const label = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(dt);
      return { name: label, hours: Number((ms / 3_600_000).toFixed(2)) };
    });
  }, [metrics.todayKey, metrics.dailyMap]);

  const recentEnglishSessions = useMemo(
    () =>
      [...englishEntries]
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 6),
    [englishEntries],
  );

  const dailyChallenge = useMemo(
    () => getChallengeForDateKey(metrics.todayKey),
    [metrics.todayKey],
  );
  const challengeRecord = useMemo(
    () =>
      settings.challengeRecords.find(
        (r) => r.dateKey === metrics.todayKey && r.challengeId === dailyChallenge.id,
      ),
    [settings.challengeRecords, metrics.todayKey, dailyChallenge.id],
  );

  const goalMinutes = Math.round(metrics.todayGoalMs / 60_000);
  const todayMinutes = Math.floor(metrics.todayDurationMs / 60_000);

  return (
    <div className="flex flex-col gap-10">
      {/* Compact Inline Telemetry & Icon Quick-Actions (Clean, Zero Card Clutter) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-text-secondary">
          <div className="flex items-center gap-1.5" title="Current streak">
            <Flame className={`h-4 w-4 ${metrics.currentStreak > 0 ? "text-[#39d353]" : "text-text-tertiary"}`} />
            <span className="font-medium text-text-primary">{metrics.currentStreak}d</span>
            <span>streak</span>
          </div>
          <span className="text-text-tertiary">·</span>
          <div className="flex items-center gap-2" title="Daily goal progress">
            <Target className="h-4 w-4 text-accent" />
            <span className="font-mono text-text-primary">
              {todayMinutes}/{goalMinutes}m
            </span>
            <div className="w-16 h-1.5 rounded-full bg-surface-raised overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${metrics.todayProgressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-text-tertiary">({metrics.todayProgressPercent}%)</span>
          </div>
          <span className="text-text-tertiary">·</span>
          <button
            type="button"
            onClick={() => onNavigateTab("vocabulary")}
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
            title="Vocabulary vault"
          >
            <BookOpen className="h-4 w-4 text-text-tertiary" />
            <span className="font-medium text-text-primary">{vocabStats.total}</span>
            <span>words</span>
            {vocabStats.due > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent-text">
                {vocabStats.due} due
              </span>
            )}
          </button>
          <span className="text-text-tertiary">·</span>
          <button
            type="button"
            onClick={() => onNavigateTab("achievements")}
            className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
            title="Achievements"
          >
            <Trophy className="h-4 w-4 text-accent" />
            <span className="font-medium text-text-primary">
              {unlockedCount}/{achievements.length}
            </span>
          </button>
        </div>

        {/* Icon-first Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Vocab", icon: BookOpen, tab: "vocabulary" as EnglishTabId, action: "add" },
            { label: "Phrase", icon: MessageSquareQuote, tab: "phrases" as EnglishTabId, action: "add" },
            { label: "Mistake", icon: TriangleAlert, tab: "mistakes" as EnglishTabId, action: "add" },
            { label: "Journal", icon: NotebookPen, tab: "practice-journal" as EnglishTabId, action: "add" },
            { label: "Flashcards", icon: Layers, tab: "vocabulary" as EnglishTabId, action: "flashcards" },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={() => onNavigateTab(btn.tab, btn.action)}
              title={btn.label}
              className="h-8 px-2.5 rounded-md border border-border bg-surface hover:bg-surface-raised hover:border-border-hover text-[12px] text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
            >
              <btn.icon className="h-3.5 w-3.5 text-accent" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* HERO: Live English Practice Clock (Time Tracker Layout) */}
      <PracticeTab
        compactTimerOnly
        prefillTitle={timerPrefill.title}
        prefillCategory={timerPrefill.category}
        onSessionSaved={onSessionSaved}
      />

      {/* TWO-COLUMN SPACIOUS ANALYTICS & LOGS (Mirrors Time Tracker) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-8">
        {/* LEFT COLUMN: Performance Analytics Graphs + Achievements Icons */}
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-[14px] font-medium text-text-primary">
                  English Practice Analytics
                </h2>
                <div className="mt-2 flex items-center gap-4 text-[13px] text-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-primary font-medium font-mono">
                      {formatDuration(periodStats.totalMs)}
                    </span>{" "}
                    total
                  </div>
                  <span className="text-text-tertiary">·</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-primary font-medium font-mono">
                      {formatDuration(periodStats.avgMs)}
                    </span>{" "}
                    avg
                  </div>
                  <span className="text-text-tertiary">·</span>
                  <div>
                    <span className="text-text-primary font-medium">{periodStats.sessionCount}</span>{" "}
                    sessions
                  </div>
                </div>
              </div>

              <div className="flex gap-4 text-[12px] font-medium text-text-tertiary">
                {periodOptions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPeriod(p)}
                    className={`transition-colors pb-1 ${
                      selectedPeriod === p
                        ? "text-text-primary border-b border-accent"
                        : "hover:text-text-primary"
                    }`}
                  >
                    {periodLabel(p)}
                  </button>
                ))}
              </div>
            </div>

            {englishEntries.length > 0 ? (
              <div className="grid gap-8 lg:grid-cols-2">
                <ChartCard title="Daily" subtitle="Last 7 days" data={dailySeries} kind="line" />
                <ChartCard title="Weekly" subtitle="Last 6 weeks" data={weeklySeries} kind="bar" />
                <ChartCard title="Monthly" subtitle="Last 12 months" data={monthlySeries} kind="line" />
                {periodStats.distribution.length > 0 ? (
                  <ChartCard
                    title="Skill Mix"
                    subtitle={periodLabel(selectedPeriod)}
                    data={periodStats.distribution}
                    kind="pie"
                  />
                ) : (
                  <div className="h-[212px] flex flex-col items-center justify-center border border-dashed border-border rounded-lg text-text-tertiary text-[12px]">
                    No sessions in {periodLabel(selectedPeriod).toLowerCase()}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-lg text-text-tertiary">
                <Clock3 className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-[13px]">Start your first English session to unlock analytics</p>
              </div>
            )}
          </section>

          {/* Compact Achievements Icon Strip right below Analytics */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-accent" />
                <h2 className="text-[14px] font-medium text-text-primary">Achievements</h2>
                <span className="text-[11px] text-text-tertiary">
                  ({unlockedCount}/{achievements.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("achievements")}
                className="text-[12px] font-medium text-accent hover:underline"
              >
                View All &rarr;
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
              {achievements.map((ach) => {
                const Icon = ACHIEVEMENT_ICONS[ach.iconName];
                return (
                  <button
                    key={ach.id}
                    type="button"
                    onClick={() => onNavigateTab("achievements")}
                    title={`${ach.title}: ${ach.current}/${ach.target} ${ach.unit}`}
                    className={`group flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 transition-all ${
                      ach.unlocked
                        ? "border-accent/40 bg-accent-subtle text-accent hover:scale-105"
                        : "border-border bg-background text-text-tertiary opacity-60 hover:opacity-90"
                    }`}
                  >
                    {ach.unlocked ? (
                      <Icon className="h-5 w-5" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    <span className="text-[9.5px] font-medium truncate w-full text-center text-text-secondary">
                      {ach.title.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Recent Sessions & Daily Speaking Challenge */}
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-medium text-text-primary">Session Log</h2>
              <button
                type="button"
                onClick={() => onNavigateTab("practice")}
                className="text-[11px] font-medium bg-surface-raised px-2.5 py-0.5 rounded border border-border text-text-secondary hover:text-text-primary"
              >
                {englishEntries.length} items &rarr;
              </button>
            </div>

            <div className="flex flex-col">
              {recentEnglishSessions.length > 0 ? (
                recentEnglishSessions.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex flex-col py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-text-primary truncate">
                          {entry.title}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-accent shrink-0">
                          {entry.subcategory || "Communication"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[12px] font-mono text-text-primary">
                          {formatDuration(entry.duration)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this session?")) void deleteEntry(entry.id);
                          }}
                          aria-label="Delete session"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-1">
                      {formatDate(entry.date)} · {formatTime(entry.startTime)} -{" "}
                      {formatTime(entry.endTime)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[12px] text-text-tertiary">
                  No English sessions logged.
                </div>
              )}
            </div>
          </section>

          {/* Compact Daily Speaking Challenge */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
                  Daily Challenge
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary">
                  {dailyChallenge.category}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary">
                {dailyChallenge.title}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-secondary">
                {dailyChallenge.prompt}
              </p>
            </div>

            {challengeRecord ? (
              <div className="flex items-center justify-between border-t border-border pt-3 text-[12px]">
                <span
                  className={`font-medium flex items-center gap-1.5 ${
                    challengeRecord.status === "completed"
                      ? "text-[#39d353]"
                      : "text-text-secondary"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {challengeRecord.status === "completed" ? "Completed today" : "Skipped today"}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab("achievements")}
                  className="text-accent hover:underline"
                >
                  History &rarr;
                </button>
              </div>
            ) : (
              <div className="border-t border-border pt-3 flex flex-col gap-2.5">
                <input
                  type="text"
                  value={challengeNotes}
                  onChange={(e) => setChallengeNotes(e.target.value)}
                  placeholder="Quick reflection note..."
                  className="w-full h-8 bg-background border border-border rounded-md px-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTimerPrefill({
                        title: dailyChallenge.title,
                        category: dailyChallenge.category,
                      })
                    }
                    className="h-8 px-3 rounded-md border border-border bg-surface-raised text-[12px] font-medium text-text-primary hover:border-border-hover flex items-center gap-1.5"
                  >
                    <Play className="h-3 w-3 text-accent" /> Use Timer
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateChallenge("completed", challengeNotes)}
                    className="h-8 px-3 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateChallenge("skipped", challengeNotes)}
                    className="h-8 px-2.5 rounded-md text-[12px] text-text-tertiary hover:text-text-primary ml-auto flex items-center gap-1"
                  >
                    <SkipForward className="h-3.5 w-3.5" /> Skip
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* BOTTOM: GitHub-Style Green Streak Contribution Heatmap */}
      <ContributionHeatmap
        metrics={metrics}
        timezone={settings.timezone}
        plannedRestDays={settings.plannedRestDays}
        onToggleRestDay={onToggleRestDay}
      />
    </div>
  );
}
