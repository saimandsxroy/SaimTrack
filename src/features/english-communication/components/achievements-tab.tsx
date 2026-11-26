"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  BookMarked,
  CalendarCheck2,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Crown,
  Database,
  Flame,
  Footprints,
  Lock,
  NotebookPen,
  Settings2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { EvaluatedAchievement } from "@/features/english-communication/english-achievements";
import {
  getChallengeForDateKey,
  getPreviousChallenges,
} from "@/features/english-communication/english-challenges";
import type { DocumentSizeStatus } from "@/features/english-communication/english-storage";
import { addDaysToDateKey } from "@/features/english-communication/english-streak";
import type { EnglishCommunicationStateDoc } from "@/features/english-communication/english-types";
import { formatDate } from "@/features/time-tracker/time-tracker-utils";

const ICON_MAP = {
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

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Australia/Sydney",
];

type AchievementsTabProps = {
  achievements: EvaluatedAchievement[];
  settings: EnglishCommunicationStateDoc;
  todayKey: string;
  docSizes: DocumentSizeStatus[];
  onSaveSettings: (next: EnglishCommunicationStateDoc) => Promise<void>;
};

export function AchievementsTab({
  achievements,
  settings,
  todayKey,
  docSizes,
  onSaveSettings,
}: AchievementsTabProps) {
  const shouldReduceMotion = useReducedMotion();
  const [goalMinutesInput, setGoalMinutesInput] = useState(
    String(Math.round(settings.dailyGoalMs / 60_000)),
  );
  const [timezoneInput, setTimezoneInput] = useState(settings.timezone);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const recentChallenges = useMemo(() => {
    const todayItem = { dateKey: todayKey, challenge: getChallengeForDateKey(todayKey) };
    const prev = getPreviousChallenges(todayKey, 7, addDaysToDateKey);
    return [todayItem, ...prev];
  }, [todayKey]);

  const challengeRecordMap = useMemo(() => {
    const map = new Map<string, (typeof settings.challengeRecords)[number]>();
    for (const r of settings.challengeRecords) {
      map.set(`${r.dateKey}:${r.challengeId}`, r);
    }
    return map;
  }, [settings.challengeRecords]);

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    const mins = Math.max(5, Math.min(480, Number(goalMinutesInput) || 30));
    const goalMs = mins * 60_000;

    // Record effective date so historical streaks remain untouched
    const filteredHistory = settings.goalHistory.filter((h) => h.effectiveDate !== todayKey);
    const nextHistory = [...filteredHistory, { effectiveDate: todayKey, goalMs }].sort((a, b) =>
      a.effectiveDate.localeCompare(b.effectiveDate),
    );

    await onSaveSettings({
      ...settings,
      dailyGoalMs: goalMs,
      timezone: timezoneInput,
      goalHistory: nextHistory,
    });
    toast.success(`Preferences updated (${mins} min/day effective ${todayKey}).`);
  }

  async function handleToggleChallenge(dateKey: string, challengeId: string) {
    const key = `${dateKey}:${challengeId}`;
    const existing = challengeRecordMap.get(key);
    const nextStatus: "completed" | "skipped" =
      existing?.status === "completed" ? "skipped" : "completed";

    const filtered = settings.challengeRecords.filter(
      (r) => !(r.dateKey === dateKey && r.challengeId === challengeId),
    );
    await onSaveSettings({
      ...settings,
      challengeRecords: [
        ...filtered,
        {
          dateKey,
          challengeId,
          status: nextStatus,
          notes: existing?.notes || "",
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    toast.success(nextStatus === "completed" ? "Challenge marked completed." : "Challenge skipped.");
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Milestones */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-medium text-text-primary">Milestones &amp; Badges</h2>
            <p className="text-[12px] text-text-secondary mt-0.5">
              {unlockedCount} of {achievements.length} milestones unlocked
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((item) => {
            const Icon = ICON_MAP[item.iconName];
            return (
              <motion.div
                key={item.id}
                initial={shouldReduceMotion || !settings.animationsEnabled ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border p-5 shadow-card transition-colors flex flex-col justify-between gap-4 ${
                  item.unlocked
                    ? "border-accent/40 bg-surface"
                    : "border-border bg-surface/60 opacity-80"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${
                      item.unlocked
                        ? "bg-accent-subtle border-accent/30 text-accent"
                        : "bg-surface-raised border-border text-text-tertiary"
                    }`}
                  >
                    {item.unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-text-primary truncate">
                        {item.title}
                      </h3>
                      {item.unlocked && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      )}
                    </div>
                    <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-text-tertiary">
                      {Math.min(item.current, item.target)} / {item.target} {item.unit}
                    </span>
                    <span className={item.unlocked ? "text-accent font-medium" : "text-text-tertiary"}>
                      {item.unlocked && item.unlockedAt
                        ? `Unlocked ${formatDate(item.unlockedAt)}`
                        : `${item.progressPercent}%`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.unlocked ? "bg-accent" : "bg-text-tertiary/40"
                      }`}
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Previous & Current Speaking Challenges */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-[15px] font-medium text-text-primary mb-1">
          Daily Speaking Challenges (Last 8 Days)
        </h2>
        <p className="text-[12px] text-text-secondary mb-4">
          Deterministic daily prompts—revisit earlier prompts or mark them complete anytime.
        </p>

        <div className="divide-y divide-border">
          {recentChallenges.map(({ dateKey, challenge }) => {
            const rec = challengeRecordMap.get(`${dateKey}:${challenge.id}`);
            return (
              <div
                key={`${dateKey}:${challenge.id}`}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-text-tertiary">{dateKey}</span>
                    {dateKey === todayKey && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent-text">
                        Today
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-text-primary">
                      {challenge.title}
                    </span>
                    <span className="text-[11px] text-text-tertiary">({challenge.category})</span>
                  </div>
                  <p className="text-[12px] text-text-secondary mt-1 line-clamp-2">
                    {challenge.prompt}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleToggleChallenge(dateKey, challenge.id)}
                  className={`h-8 px-3 rounded-md border text-[12px] font-medium shrink-0 transition-colors ${
                    rec?.status === "completed"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-background text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {rec?.status === "completed" ? "Completed ✓" : "Mark Complete"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Goal Preferences & Document Size Awareness */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-[15px] font-medium text-text-primary flex items-center gap-2 mb-4">
            <Settings2 className="h-4 w-4 text-accent" />
            Goal &amp; Timezone Preferences
          </h2>

          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">
                  Daily Goal (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={goalMinutesInput}
                  onChange={(e) => setGoalMinutesInput(e.target.value)}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Timezone</label>
                <select
                  value={timezoneInput}
                  onChange={(e) => setTimezoneInput(e.target.value)}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                >
                  {Array.from(new Set([settings.timezone, ...COMMON_TIMEZONES])).map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={settings.animationsEnabled}
                onChange={(e) =>
                  void onSaveSettings({ ...settings, animationsEnabled: e.target.checked })
                }
                className="h-4 w-4 accent-[#CBA365]"
              />
              Enable streak completion animations
            </label>

            <p className="text-[11px] text-text-tertiary">
              Goal changes take effect starting today ({todayKey}) so historical streak achievements
              remain preserved.
            </p>

            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90"
            >
              Save Preferences
            </button>
          </form>
        </section>

        {/* Firestore Storage Health */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <h2 className="text-[15px] font-medium text-text-primary flex items-center gap-2 mb-1">
            <Database className="h-4 w-4 text-accent" />
            Firestore Document Capacity Monitor
          </h2>
          <p className="text-[12px] text-text-secondary mb-4">
            Monitors payloads against Firestore&apos;s 1 MiB document ceiling.
          </p>

          <div className="space-y-3">
            {docSizes.map((docInfo) => (
              <div key={docInfo.docName} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-mono text-text-primary">{docInfo.docName}</span>
                  <span
                    className={
                      docInfo.nearLimit ? "text-warning font-medium" : "text-text-secondary"
                    }
                  >
                    {(docInfo.bytes / 1024).toFixed(1)} KiB ({docInfo.percentOfLimit}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      docInfo.overLimit
                        ? "bg-destructive"
                        : docInfo.nearLimit
                          ? "bg-warning"
                          : "bg-accent"
                    }`}
                    style={{ width: `${Math.max(2, docInfo.percentOfLimit)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
