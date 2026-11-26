"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Flame, MoonStar, Sparkles } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import type { DailyEnglishSummary, EnglishStreakMetrics } from "@/features/english-communication/english-streak";
import { addDaysToDateKey, toZonedDateKey } from "@/features/english-communication/english-streak";
import { formatDuration, formatTime } from "@/features/time-tracker/time-tracker-utils";

type ContributionHeatmapProps = {
  metrics: EnglishStreakMetrics;
  timezone: string;
  plannedRestDays: string[];
  onToggleRestDay: (dateKey: string) => void;
};

type HeatmapCell = {
  dateKey: string;
  inYear: boolean;
  summary: DailyEnglishSummary | null;
  level: 0 | 1 | 2 | 3 | 4;
};

function getIntensityLevel(durationMs: number): 0 | 1 | 2 | 3 | 4 {
  if (durationMs <= 0) return 0;
  const mins = durationMs / 60_000;
  if (mins < 15) return 1;
  if (mins < 30) return 2;
  if (mins < 60) return 3;
  return 4;
}

const LEVEL_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-[#1A1A1E] border border-white/[0.04]",
  1: "bg-[#4A3820] border border-[#5D4628]",
  2: "bg-[#856638] border border-[#9B7843]",
  3: "bg-[#CBA365] border border-[#D8B57C]",
  4: "bg-[#E6C68E] border border-[#F0D6A8]",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ContributionHeatmap({
  metrics,
  timezone,
  plannedRestDays,
  onToggleRestDay,
}: ContributionHeatmapProps) {
  const currentYear = Number(metrics.todayKey.slice(0, 4));
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [drawerDateKey, setDrawerDateKey] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    for (const key of metrics.dailyMap.keys()) {
      const y = Number(key.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [metrics.dailyMap, currentYear]);

  const { weeks, monthLabels, yearStats } = useMemo(() => {
    const jan1Key = `${selectedYear}-01-01`;
    const dec31Key = `${selectedYear}-12-31`;
    const [y, m, d] = jan1Key.split("-").map(Number);
    const jan1DayOfWeek = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay(); // 0=Sun..6=Sat
    const startCursor = addDaysToDateKey(jan1Key, -jan1DayOfWeek);

    const weekCols: HeatmapCell[][] = [];
    const monthPositions: Array<{ label: string; colIndex: number }> = [];
    let seenMonth = -1;

    let cursor = startCursor;
    let totalDurationYear = 0;
    let activeDaysYear = 0;
    let completedDaysYear = 0;

    for (let col = 0; col < 54; col += 1) {
      const week: HeatmapCell[] = [];
      let colHasInYear = false;

      for (let row = 0; row < 7; row += 1) {
        const inYear = cursor >= jan1Key && cursor <= dec31Key;
        const summary = metrics.dailyMap.get(cursor) ?? null;
        const duration = summary?.durationMs ?? 0;

        if (inYear) {
          colHasInYear = true;
          totalDurationYear += duration;
          if (duration > 0) activeDaysYear += 1;
          if (summary?.completed) completedDaysYear += 1;

          const monthIdx = Number(cursor.slice(5, 7)) - 1;
          if (monthIdx !== seenMonth && Number(cursor.slice(8, 10)) <= 7) {
            seenMonth = monthIdx;
            monthPositions.push({ label: MONTH_NAMES[monthIdx], colIndex: col });
          }
        }

        week.push({
          dateKey: cursor,
          inYear,
          summary,
          level: inYear ? getIntensityLevel(duration) : 0,
        });
        cursor = addDaysToDateKey(cursor, 1);
      }

      if (colHasInYear || col === 0) {
        weekCols.push(week);
      }
      if (cursor > dec31Key && col > 48) break;
    }

    return {
      weeks: weekCols,
      monthLabels: monthPositions,
      yearStats: { totalDurationYear, activeDaysYear, completedDaysYear },
    };
  }, [selectedYear, metrics.dailyMap]);

  const drawerSummary = drawerDateKey ? metrics.dailyMap.get(drawerDateKey) : null;
  const isRestDay = drawerDateKey ? plannedRestDays.includes(drawerDateKey) : false;

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-[14px] font-medium text-text-primary flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" />
            Practice Consistency Heatmap
          </h2>
          <p className="mt-1 text-[12px] text-text-secondary">
            {yearStats.activeDaysYear} active days · {yearStats.completedDaysYear} goals met ·{" "}
            {(yearStats.totalDurationYear / 3_600_000).toFixed(1)} hrs in {selectedYear}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <Flame className="h-3.5 w-3.5 text-accent" />
            <span>
              Streak: <strong className="text-text-primary">{metrics.currentStreak}d</strong>
            </span>
          </div>
          <div className="text-text-secondary">
            Longest: <strong className="text-text-primary">{metrics.longestStreak}d</strong>
          </div>
          <div className="text-text-secondary">
            Total Active: <strong className="text-text-primary">{metrics.totalActiveDays}d</strong>
          </div>
          <select
            aria-label="Select heatmap year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-[12px] text-text-primary focus:outline-accent"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col min-w-[720px]">
          {/* Month labels */}
          <div className="flex pl-8 mb-1.5 relative h-4">
            {monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.colIndex}`}
                className="absolute text-[10px] font-medium text-text-tertiary"
                style={{ left: `${32 + m.colIndex * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-2">
            {/* Weekday labels */}
            <div className="grid grid-rows-7 gap-[3px] pr-1 text-[10px] text-text-tertiary w-6 shrink-0">
              <span className="h-[11px]" />
              <span className="h-[11px] leading-[11px]">Mon</span>
              <span className="h-[11px]" />
              <span className="h-[11px] leading-[11px]">Wed</span>
              <span className="h-[11px]" />
              <span className="h-[11px] leading-[11px]">Fri</span>
              <span className="h-[11px]" />
            </div>

            {/* 53-week CSS Grid */}
            <div className="grid grid-flow-col gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
                  {week.map((cell) => {
                    if (!cell.inYear) {
                      return <div key={cell.dateKey} className="h-[11px] w-[11px]" />;
                    }
                    const isRest = plannedRestDays.includes(cell.dateKey);
                    const isToday = cell.dateKey === metrics.todayKey;
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onMouseEnter={() => setHoveredCell(cell)}
                        onFocus={() => setHoveredCell(cell)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => setDrawerDateKey(cell.dateKey)}
                        aria-label={`${cell.dateKey}: ${Math.round((cell.summary?.durationMs ?? 0) / 60000)} minutes practiced`}
                        className={`h-[11px] w-[11px] rounded-[2px] transition-transform hover:scale-125 focus:scale-125 ${
                          LEVEL_STYLES[cell.level]
                        } ${isToday ? "ring-1 ring-accent ring-offset-1 ring-offset-surface" : ""} ${
                          isRest && cell.level === 0 ? "border-dashed border-accent/50" : ""
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Tooltip & Legend */}
      <div className="mt-4 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px]">
        <div className="min-h-[18px] text-text-secondary flex items-center gap-2">
          {hoveredCell ? (
            <>
              <span className="font-medium text-text-primary">{hoveredCell.dateKey}</span>
              <span>·</span>
              <span className="font-mono text-accent">
                {formatDuration(hoveredCell.summary?.durationMs ?? 0)}
              </span>
              <span>
                ({hoveredCell.summary?.sessionCount ?? 0} session
                {(hoveredCell.summary?.sessionCount ?? 0) === 1 ? "" : "s"})
              </span>
              {hoveredCell.summary?.completed && (
                <span className="inline-flex items-center gap-1 text-success font-medium">
                  <CheckCircle2 className="h-3 w-3" /> Goal met
                </span>
              )}
              {plannedRestDays.includes(hoveredCell.dateKey) && (
                <span className="inline-flex items-center gap-1 text-accent-text">
                  <MoonStar className="h-3 w-3" /> Planned rest day
                </span>
              )}
            </>
          ) : (
            <span className="text-text-tertiary">
              Click any square to inspect that day&apos;s English sessions or toggle a rest day.
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-text-tertiary shrink-0">
          <span>0m</span>
          <span className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_STYLES[0]}`} title="0 minutes" />
          <span className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_STYLES[1]}`} title="< 15 minutes" />
          <span className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_STYLES[2]}`} title="15–29 minutes" />
          <span className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_STYLES[3]}`} title="30–59 minutes" />
          <span className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_STYLES[4]}`} title="60+ minutes" />
          <span>60m+</span>
        </div>
      </div>

      {/* Day Sessions Drawer */}
      <Drawer
        isOpen={Boolean(drawerDateKey)}
        onClose={() => setDrawerDateKey(null)}
        title={drawerDateKey ? `Practice Activity · ${drawerDateKey}` : "Practice Activity"}
        footer={
          drawerDateKey ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-text-secondary">
                {isRestDay ? "Marked as planned rest day" : "Regular practice day"}
              </span>
              <button
                type="button"
                onClick={() => onToggleRestDay(drawerDateKey)}
                className="h-9 px-3 rounded-md border border-border bg-surface text-[12px] font-medium text-text-primary hover:border-border-hover transition-colors flex items-center gap-1.5"
              >
                <MoonStar className="h-3.5 w-3.5 text-accent" />
                {isRestDay ? "Remove Rest Day" : "Mark Planned Rest Day"}
              </button>
            </div>
          ) : null
        }
      >
        {drawerDateKey && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-background p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-text-tertiary">Total Duration</div>
                <div className="text-[24px] font-semibold font-mono text-text-primary mt-0.5">
                  {formatDuration(drawerSummary?.durationMs ?? 0)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-text-tertiary">Daily Goal</div>
                <div className="mt-1">
                  {drawerSummary?.completed ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-success">
                      <Sparkles className="h-3.5 w-3.5" /> Goal Completed
                    </span>
                  ) : (
                    <span className="text-[12px] text-text-secondary">
                      Target: {Math.round((drawerSummary?.goalMs ?? metrics.todayGoalMs) / 60000)}m
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary">
                Sessions ({drawerSummary?.sessions.length ?? 0})
              </h4>
              {drawerSummary && drawerSummary.sessions.length > 0 ? (
                drawerSummary.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-lg border border-border bg-background p-3.5 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-text-primary truncate">
                        {session.title}
                      </span>
                      <span className="text-[12px] font-mono text-accent shrink-0">
                        {formatDuration(session.duration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
                      <span className="px-1.5 py-0.5 rounded bg-accent-subtle text-accent-text">
                        {session.subcategory || session.category}
                      </span>
                      <span>
                        {formatTime(session.startTime)} – {formatTime(session.endTime)}
                      </span>
                      <span className="ml-auto text-[10px]">
                        {toZonedDateKey(session.startTime, timezone)}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-[12px] text-text-secondary mt-1 border-l-2 border-border pl-2">
                        {session.notes}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border py-10 text-center text-[12px] text-text-tertiary">
                  No English practice sessions recorded on {drawerDateKey}.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </section>
  );
}
