"use client";

import { useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Flame,
  Layers,
  MessageSquareQuote,
  NotebookPen,
  Play,
  SkipForward,
  Sparkles,
  Target,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import dynamic from "next/dynamic";

import { ContributionHeatmap } from "@/features/english-communication/components/contribution-heatmap";
import { PracticeTab } from "@/features/english-communication/components/practice-tab";
import { getChallengeForDateKey } from "@/features/english-communication/english-challenges";
import { isItemDue } from "@/features/english-communication/english-srs";
import {
  addDaysToDateKey,
  getEnglishEntries,
  type EnglishStreakMetrics,
} from "@/features/english-communication/english-streak";
import type {
  CommunicationAssessment,
  EnglishCommunicationStateDoc,
  EnglishPracticeCategory,
  EnglishTabId,
  VocabularyItem,
} from "@/features/english-communication/english-types";
import type { TimeEntry } from "@/features/time-tracker/time-tracker-types";
import { formatDate, formatDuration } from "@/features/time-tracker/time-tracker-utils";

const ChartCard = dynamic(
  () => import("@/features/time-tracker/time-charts").then((mod) => mod.ChartCard),
  {
    ssr: false,
    loading: () => (
      <div className="h-[212px] animate-pulse bg-surface-raised rounded-lg border border-border" />
    ),
  },
);

type OverviewTabProps = {
  metrics: EnglishStreakMetrics;
  settings: EnglishCommunicationStateDoc;
  allEntries: TimeEntry[];
  vocabulary: VocabularyItem[];
  assessments: CommunicationAssessment[];
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
  assessments,
  onNavigateTab,
  onToggleRestDay,
  onUpdateChallenge,
  onSessionSaved,
}: OverviewTabProps) {
  const [challengeNotes, setChallengeNotes] = useState("");
  const [timerPrefill, setTimerPrefill] = useState<{
    title?: string;
    category?: EnglishPracticeCategory;
  }>({});

  const vocabStats = useMemo(() => {
    const nowMs = Date.now();
    const total = vocabulary.length;
    const mastered = vocabulary.filter((v) => v.masteryLevel === "Mastered").length;
    const due = vocabulary.filter((v) => isItemDue(v, nowMs)).length;
    return { total, mastered, due };
  }, [vocabulary]);

  const latestAssessment = useMemo(() => {
    if (!assessments.length) return null;
    const sorted = [...assessments].sort((a, b) =>
      b.assessmentDate.localeCompare(a.assessmentDate),
    );
    const latest = sorted[0];
    const avg =
      (latest.fluency +
        latest.grammar +
        latest.vocabulary +
        latest.pronunciation +
        latest.confidence +
        latest.clarity +
        latest.sentenceFormation) /
      7;
    return { latest, avg: avg.toFixed(1) };
  }, [assessments]);

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

  // Last 7 days series for overview weekly practice chart
  const last7DaysSeries = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysToDateKey(metrics.todayKey, -(6 - i));
      const summary = metrics.dailyMap.get(key);
      const [y, m, d] = key.split("-").map(Number);
      const label = new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
        new Date(Date.UTC(y, m - 1, d, 12, 0, 0)),
      );
      return {
        name: label,
        hours: Number(((summary?.durationMs ?? 0) / 3_600_000).toFixed(2)),
      };
    });
  }, [metrics.todayKey, metrics.dailyMap]);

  const recentEnglishSessions = useMemo(
    () =>
      getEnglishEntries(allEntries)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 6),
    [allEntries],
  );

  const goalMinutes = Math.round(metrics.todayGoalMs / 60_000);
  const todayMinutes = Math.floor(metrics.todayDurationMs / 60_000);

  const metricCards = [
    {
      label: "Today's Practice",
      value: formatDuration(metrics.todayDurationMs),
      sub: `${todayMinutes} / ${goalMinutes} min goal`,
      icon: Clock3,
      accent: metrics.todayGoalCompleted,
    },
    {
      label: "Daily Goal Progress",
      value: `${metrics.todayProgressPercent}%`,
      sub: metrics.todayGoalCompleted ? "Goal completed today" : `${Math.max(0, goalMinutes - todayMinutes)} min remaining`,
      icon: Target,
      progress: metrics.todayProgressPercent,
    },
    {
      label: "Current Streak",
      value: `${metrics.currentStreak} day${metrics.currentStreak === 1 ? "" : "s"}`,
      sub: metrics.todayGoalCompleted ? "Flame active today" : "Complete today to extend",
      icon: Flame,
      accent: metrics.currentStreak > 0,
    },
    {
      label: "Longest Streak",
      value: `${metrics.longestStreak} day${metrics.longestStreak === 1 ? "" : "s"}`,
      sub: `${metrics.totalCompletedDays} completed days`,
      icon: Trophy,
    },
    {
      label: "Weekly Practice",
      value: formatDuration(metrics.weeklyDurationMs),
      sub: "This week (Mon–Sun)",
      icon: CalendarCheck2,
    },
    {
      label: "Monthly Practice",
      value: formatDuration(metrics.monthlyDurationMs),
      sub: "Current calendar month",
      icon: CalendarCheck2,
    },
    {
      label: "Lifetime Practice",
      value: formatDuration(metrics.lifetimeDurationMs),
      sub: `${(metrics.lifetimeDurationMs / 3_600_000).toFixed(1)} total hours`,
      icon: Sparkles,
    },
    {
      label: "Total Vocabulary",
      value: String(vocabStats.total),
      sub: "Words in vault",
      icon: BookOpen,
    },
    {
      label: "Mastered Words",
      value: String(vocabStats.mastered),
      sub: vocabStats.total ? `${Math.round((vocabStats.mastered / vocabStats.total) * 100)}% mastery` : "Start adding words",
      icon: Award,
    },
    {
      label: "Due for Revision",
      value: String(vocabStats.due),
      sub: vocabStats.due > 0 ? "Ready for flashcards" : "Queue clear",
      icon: Layers,
      accent: vocabStats.due > 0,
    },
    {
      label: "Sessions Completed",
      value: String(metrics.totalSessionsCount),
      sub: `${metrics.dailyCompletionRate}% daily completion rate`,
      icon: CheckCircle2,
    },
    {
      label: "Latest Assessment",
      value: latestAssessment ? `${latestAssessment.avg} / 10` : "—",
      sub: latestAssessment
        ? `${latestAssessment.latest.assessmentDate} · ${latestAssessment.latest.assessmentSource}`
        : "No self-assessment yet",
      icon: NotebookPen,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* 12 Metric Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-surface p-4 shadow-card hover:border-border-hover transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
                  {card.label}
                </span>
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    card.accent ? "text-accent" : "text-text-tertiary"
                  }`}
                />
              </div>
              <div className="mt-2.5">
                <div className="text-[22px] font-semibold text-text-primary tracking-tight tabular-nums">
                  {card.value}
                </div>
                {typeof card.progress === "number" && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${card.progress}%` }}
                    />
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-text-secondary truncate">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* Quick Actions */}
      <section className="flex flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-text-tertiary mr-1">
          Quick Actions:
        </span>
        {[
          { label: "Start Practice", icon: Play, tab: "practice" as EnglishTabId },
          { label: "Add Vocabulary", icon: BookOpen, tab: "vocabulary" as EnglishTabId, action: "add" },
          { label: "Add Phrase", icon: MessageSquareQuote, tab: "phrases" as EnglishTabId, action: "add" },
          { label: "Log Grammar Mistake", icon: TriangleAlert, tab: "mistakes" as EnglishTabId, action: "add" },
          { label: "Add Practice Journal", icon: NotebookPen, tab: "practice-journal" as EnglishTabId, action: "add" },
          { label: "Review Flashcards", icon: Layers, tab: "vocabulary" as EnglishTabId, action: "flashcards" },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => onNavigateTab(btn.tab, btn.action)}
            className="h-8 px-3 rounded-md border border-border bg-surface hover:bg-surface-raised hover:border-border-hover text-[12px] font-medium text-text-primary transition-colors flex items-center gap-1.5"
          >
            <btn.icon className="h-3.5 w-3.5 text-accent" />
            {btn.label}
          </button>
        ))}
      </section>

      {/* Live English Timer */}
      <PracticeTab
        compactTimerOnly
        prefillTitle={timerPrefill.title}
        prefillCategory={timerPrefill.category}
        onSessionSaved={onSessionSaved}
      />

      {/* Annual Contribution Heatmap */}
      <ContributionHeatmap
        metrics={metrics}
        timezone={settings.timezone}
        plannedRestDays={settings.plannedRestDays}
        onToggleRestDay={onToggleRestDay}
      />

      {/* Weekly Chart & Daily Challenge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-medium text-text-primary">7-Day Practice Rhythm</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Hours logged over the past 7 days
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("analytics")}
              className="text-[12px] font-medium text-accent hover:underline"
            >
              Full Analytics &rarr;
            </button>
          </div>
          <ChartCard title="Daily Hours" subtitle="Last 7 days" data={last7DaysSeries} kind="bar" />
        </section>

        {/* Daily Speaking Challenge */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-accent">
                Today&apos;s Speaking Challenge
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary">
                {dailyChallenge.category} · ~{dailyChallenge.estimatedMinutes}m
              </span>
            </div>
            <h3 className="text-[16px] font-semibold text-text-primary">{dailyChallenge.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
              {dailyChallenge.prompt}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dailyChallenge.tips.map((tip) => (
                <span
                  key={tip}
                  className="text-[11px] px-2 py-0.5 rounded bg-background border border-border text-text-tertiary"
                >
                  {tip}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4 flex flex-col gap-3">
            {challengeRecord ? (
              <div className="flex items-center justify-between text-[12px]">
                <span
                  className={`font-medium flex items-center gap-1.5 ${
                    challengeRecord.status === "completed" ? "text-success" : "text-text-secondary"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {challengeRecord.status === "completed"
                    ? "Challenge completed today!"
                    : "Skipped for today"}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab("achievements")}
                  className="text-accent hover:underline"
                >
                  Challenge History &rarr;
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={challengeNotes}
                  onChange={(e) => setChallengeNotes(e.target.value)}
                  placeholder="Optional reflection or practice notes..."
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
                />
                <div className="flex flex-wrap items-center gap-2">
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
                    <Play className="h-3.5 w-3.5 text-accent" /> Load in Timer
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateChallenge("completed", challengeNotes)}
                    className="h-8 px-3 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateChallenge("skipped", challengeNotes)}
                    className="h-8 px-3 rounded-md border border-border text-[12px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 ml-auto"
                  >
                    <SkipForward className="h-3.5 w-3.5" /> Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Recent English Sessions */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-medium text-text-primary">Recent English Sessions</h2>
          <button
            type="button"
            onClick={() => onNavigateTab("practice")}
            className="text-[12px] font-medium text-accent hover:underline"
          >
            Manage Sessions &rarr;
          </button>
        </div>
        {recentEnglishSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentEnglishSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-lg border border-border bg-background p-3.5 flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-medium text-text-primary line-clamp-1">
                    {session.title}
                  </span>
                  <span className="text-[12px] font-mono text-accent shrink-0">
                    {formatDuration(session.duration)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                  <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent-text">
                    {session.subcategory || "Communication"}
                  </span>
                  <span>{formatDate(session.date)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-[12px] text-text-tertiary border border-dashed border-border rounded-lg">
            No English practice sessions logged yet. Start the live timer above to earn today&apos;s streak!
          </div>
        )}
      </section>
    </div>
  );
}
