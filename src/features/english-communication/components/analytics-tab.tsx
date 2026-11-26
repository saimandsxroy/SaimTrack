"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart3, Clock3, Flame, Target } from "lucide-react";

import {
  addDaysToDateKey,
  getEnglishEntries,
  toZonedDateKey,
  type EnglishStreakMetrics,
} from "@/features/english-communication/english-streak";
import {
  masteryLevels,
  type CommunicationAssessment,
  type GrammarMistakeItem,
  type VocabularyItem,
} from "@/features/english-communication/english-types";
import type { TimeEntry, TimeTrackerPeriod } from "@/features/time-tracker/time-tracker-types";
import {
  formatDuration,
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

type AnalyticsTabProps = {
  allEntries: TimeEntry[];
  metrics: EnglishStreakMetrics;
  timezone: string;
  vocabulary: VocabularyItem[];
  mistakes: GrammarMistakeItem[];
  assessments: CommunicationAssessment[];
};

const periodOptions: TimeTrackerPeriod[] = ["today", "week", "month", "year", "lifetime"];

export function AnalyticsTab({
  allEntries,
  metrics,
  timezone,
  vocabulary,
  mistakes,
  assessments,
}: AnalyticsTabProps) {
  const [period, setPeriod] = useState<TimeTrackerPeriod>("month");

  const englishEntries = useMemo(() => getEnglishEntries(allEntries), [allEntries]);

  const { scopedEntries, totalDuration, avgDuration, categoryTotalsMap } = useMemo(() => {
    const todayKey = metrics.todayKey;
    const [ty, tm, td] = todayKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0)).getUTCDay() || 7;
    const weekStartKey = addDaysToDateKey(todayKey, -(weekday - 1));
    const monthStartKey = `${todayKey.slice(0, 7)}-01`;
    const yearStartKey = `${todayKey.slice(0, 4)}-01-01`;

    if (period === "lifetime") {
      const catMap = new Map<string, number>();
      for (const e of englishEntries) {
        const cat = e.subcategory || e.category || "Communication";
        catMap.set(cat, (catMap.get(cat) ?? 0) + e.duration);
      }
      const total = metrics.lifetimeDurationMs;
      const avg = englishEntries.length ? total / englishEntries.length : 0;
      return {
        scopedEntries: englishEntries,
        totalDuration: total,
        avgDuration: avg,
        categoryTotalsMap: catMap,
      };
    }

    const startKey =
      period === "today"
        ? todayKey
        : period === "week"
          ? weekStartKey
          : period === "month"
            ? monthStartKey
            : yearStartKey;

    let total = 0;
    const seenIds = new Set<string>();
    const list: TimeEntry[] = [];
    const catMap = new Map<string, number>();

    for (const [key, summary] of metrics.dailyMap.entries()) {
      if (key >= startKey && key <= todayKey) {
        total += summary.durationMs;
        for (const s of summary.sessions) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            list.push(s);
            const cat = s.subcategory || s.category || "Communication";
            catMap.set(cat, (catMap.get(cat) ?? 0) + s.duration);
          }
        }
      }
    }

    return {
      scopedEntries: list,
      totalDuration: total,
      avgDuration: list.length ? total / list.length : 0,
      categoryTotalsMap: catMap,
    };
  }, [englishEntries, period, metrics]);

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
      return {
        name: `W${wIdx + 1}`,
        hours: Number((ms / 3_600_000).toFixed(2)),
      };
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
      return {
        name: label,
        hours: Number((ms / 3_600_000).toFixed(2)),
      };
    });
  }, [metrics.todayKey, metrics.dailyMap]);

  const categoryDistribution = useMemo(() => {
    return Array.from(categoryTotalsMap.entries()).map(([name, ms]) => ({
      name,
      value: Number((ms / 3_600_000).toFixed(2)),
    }));
  }, [categoryTotalsMap]);

  const vocabGrowthSeries = useMemo(() => {
    const [curYear, curMonth] = metrics.todayKey.split("-").map(Number);
    return Array.from({ length: 6 }, (_, idx) => {
      const dt = new Date(Date.UTC(curYear, curMonth - 1 - (5 - idx), 1, 12, 0, 0));
      const ym = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
      const cumulative = vocabulary.filter(
        (v) => toZonedDateKey(v.createdAt, timezone).slice(0, 7) <= ym,
      ).length;
      const label = new Intl.DateTimeFormat("en-IN", { month: "short" }).format(dt);
      return { name: label, hours: cumulative };
    });
  }, [vocabulary, metrics.todayKey, timezone]);

  const vocabMasteryPie = useMemo(() => {
    return masteryLevels
      .map((lvl) => ({
        name: lvl,
        value: vocabulary.filter((v) => v.masteryLevel === lvl).length,
      }))
      .filter((d) => d.value > 0);
  }, [vocabulary]);

  const mistakeTrendBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mistakes) {
      map.set(m.grammarCategory, (map.get(m.grammarCategory) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, hours: count }));
  }, [mistakes]);

  const assessmentTrendSeries = useMemo(() => {
    return [...assessments]
      .sort((a, b) => a.assessmentDate.localeCompare(b.assessmentDate))
      .map((a) => ({
        name: a.assessmentDate.slice(5),
        hours: Number(
          (
            (a.fluency +
              a.grammar +
              a.vocabulary +
              a.pronunciation +
              a.confidence +
              a.clarity +
              a.sentenceFormation) /
            7
          ).toFixed(1),
        ),
      }));
  }, [assessments]);

  return (
    <div className="flex flex-col gap-8">
      {/* Period Selector & Summary */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-[16px] font-medium text-text-primary flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              English Practice Analytics
            </h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              Derived dynamically from shared Time Tracker sessions &amp; practice logs.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-[12px] font-medium text-text-tertiary">
            {periodOptions.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`pb-1 transition-colors ${
                  period === p
                    ? "text-text-primary border-b border-accent"
                    : "hover:text-text-primary"
                }`}
              >
                {periodLabel(p)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-accent" /> Practice Duration
            </div>
            <div className="text-[22px] font-semibold font-mono text-text-primary mt-1.5">
              {formatDuration(totalDuration)}
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {scopedEntries.length} sessions in {periodLabel(period).toLowerCase()}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary">
              Average Session
            </div>
            <div className="text-[22px] font-semibold font-mono text-text-primary mt-1.5">
              {formatDuration(avgDuration)}
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">Per completed session</div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-accent" /> Goal Completion Rate
            </div>
            <div className="text-[22px] font-semibold text-text-primary mt-1.5">
              {metrics.dailyCompletionRate}%
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {metrics.totalCompletedDays} completed days
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-[11px] uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-accent" /> Streak History
            </div>
            <div className="text-[22px] font-semibold text-text-primary mt-1.5">
              {metrics.currentStreak}d / {metrics.longestStreak}d
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">Current / Longest streak</div>
          </div>
        </div>
      </div>

      {/* Time & Practice Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <ChartCard title="Daily Activity (Hours)" subtitle="Last 7 days" data={dailySeries} kind="line" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <ChartCard title="Weekly Activity (Hours)" subtitle="Last 6 weeks" data={weeklySeries} kind="bar" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <ChartCard title="Monthly Trends (Hours)" subtitle="Last 12 months" data={monthlySeries} kind="line" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          {categoryDistribution.length > 0 ? (
            <ChartCard
              title={`Category Mix (${periodLabel(period)})`}
              subtitle="Hours per skill"
              data={categoryDistribution}
              kind="pie"
            />
          ) : (
            <div className="h-[212px] flex items-center justify-center text-[12px] text-text-tertiary border border-dashed border-border rounded-lg">
              No sessions in selected period.
            </div>
          )}
        </div>
      </div>

      {/* Vocabulary, Mistakes & Assessment Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <ChartCard
            title="Vocabulary Growth (Cumulative Words)"
            subtitle="Last 6 months"
            data={vocabGrowthSeries}
            kind="line"
          />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          {vocabMasteryPie.length > 0 ? (
            <ChartCard
              title="Vocabulary Mastery Distribution"
              subtitle="Words by stage"
              data={vocabMasteryPie}
              kind="pie"
            />
          ) : (
            <div className="h-[212px] flex items-center justify-center text-[12px] text-text-tertiary border border-dashed border-border rounded-lg">
              Add vocabulary words to see mastery breakdown.
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          {mistakeTrendBars.length > 0 ? (
            <ChartCard
              title="Grammar Mistake Categories"
              subtitle="Count by area"
              data={mistakeTrendBars}
              kind="bar"
            />
          ) : (
            <div className="h-[212px] flex items-center justify-center text-[12px] text-text-tertiary border border-dashed border-border rounded-lg">
              Log grammar mistakes to view category trends.
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          {assessmentTrendSeries.length > 0 ? (
            <ChartCard
              title="Weekly Assessment Average (1–10)"
              subtitle="Manual self-assessment scores"
              data={assessmentTrendSeries}
              kind="line"
            />
          ) : (
            <div className="h-[212px] flex items-center justify-center text-[12px] text-text-tertiary border border-dashed border-border rounded-lg">
              Log weekly self-assessments to track score progression.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
