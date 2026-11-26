"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Download,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import dynamic from "next/dynamic";

const ChartCard = dynamic(
  () => import("@/features/time-tracker/time-charts").then((mod) => mod.ChartCard),
  { ssr: false, loading: () => <div className="h-[212px] animate-pulse bg-surface-raised rounded-lg border border-border" /> }
);

import {
  buildCategorySeries,
  buildDailySeries,
  buildMonthlySeries,
  buildWeeklySeries,
  averageDuration,
  combineDateAndTime,
  filterEntries,
  formatDate,
  formatDuration,
  formatTime,
  mostActiveCategory,
  periodLabel,
  sumDuration,
  toDateInputValue,
  toTimeInputValue,
} from "@/features/time-tracker/time-tracker-utils";
import { useTimeTracker } from "@/features/time-tracker/time-tracker-context";
import {
  timeCategories,
  type TimeCategory,
  type TimeTrackerPeriod,
} from "@/features/time-tracker/time-tracker-types";

type ManualEntryFormValues = {
  title: string;
  category: TimeCategory;
  date: string;
  startTime: string;
  endTime: string;
};

const manualEntrySchema = z
  .object({
    title: z.string().min(2, "Add a descriptive title."),
    category: z.string().min(1, "Category is required."),
    date: z.string().min(1, "Pick a date."),
    startTime: z.string().min(1, "Start time is required."),
    endTime: z.string().min(1, "End time is required."),
  })
  .refine((data) => combineDateAndTime(data.date, data.endTime) > combineDateAndTime(data.date, data.startTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

const periodOptions: TimeTrackerPeriod[] = ["today", "week", "month", "year", "lifetime"];

// Animation configurations
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } }
};

export function TimeTrackerClient() {
  const {
    hydrated,
    entries,
    activeTimer,
    customCategories,
    liveDuration,
    syncStatus,
    pendingCount,
    retrySync,
    startTimer: startSharedTimer,
    pauseTimer: pauseSharedTimer,
    resumeTimer: resumeSharedTimer,
    stopTimer: stopSharedTimer,
    discardTimer: discardSharedTimer,
    updateActiveTimerMeta,
    addManualEntry,
    deleteEntry: deleteSharedEntry,
    addCustomCategory,
    resetWorkspace,
  } = useTimeTracker();

  const [timerTitle, setTimerTitle] = useState("Focused study session");
  const [timerCategory, setTimerCategory] = useState<TimeCategory>("DSA");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const allCategories = useMemo(() => [...timeCategories, ...customCategories], [customCategories]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimeTrackerPeriod>("today");
  const [query] = useState("");
  const [categoryFilter] = useState<TimeCategory | "all">("all");
  const [isPending, startTransition] = useTransition();

  const manualForm = useForm<ManualEntryFormValues>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      title: "",
      category: "DSA",
      date: toDateInputValue(new Date()),
      startTime: toTimeInputValue(new Date(Date.now() - 45 * 60 * 1000)),
      endTime: toTimeInputValue(new Date()),
    },
  });

  useEffect(() => {
    if (activeTimer) {
      setTimerTitle(activeTimer.title);
      setTimerCategory(activeTimer.category);
    }
  }, [activeTimer?.id]);

  const visibleEntries = useMemo(() => {
    const scopedEntries = filterEntries(entries, selectedPeriod);
    const normalizedQuery = query.trim().toLowerCase();

    return scopedEntries
      .filter((entry) =>
        categoryFilter === "all" ? true : entry.category === categoryFilter,
      )
      .filter((entry) => {
        if (!normalizedQuery) return true;
        return (
          entry.title.toLowerCase().includes(normalizedQuery) ||
          entry.category.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime());
  }, [categoryFilter, entries, query, selectedPeriod]);

  const analyticsEntries = filterEntries(entries, selectedPeriod);
  const totalDuration = sumDuration(analyticsEntries);
  const entryCount = analyticsEntries.length;
  const avgDuration = averageDuration(analyticsEntries);

  // Session Log panel always shows ALL sessions sorted newest-first (not scoped to period)
  const recentEntries = useMemo(() =>
    [...entries].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [entries]
  );

  const dailySeries = buildDailySeries(entries);
  const weeklySeries = buildWeeklySeries(entries);
  const monthlySeries = buildMonthlySeries(entries);
  const categorySeries = buildCategorySeries(entries);

  async function handleAddCustomCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (trimmed && !allCategories.includes(trimmed)) {
      await addCustomCategory(trimmed);
      setTimerCategory(trimmed);
    }
    setNewCategoryName("");
    setIsAddingCategory(false);
  }

  function startTimer() {
    void startSharedTimer({
      title: timerTitle.trim() || "Focused study session",
      category: timerCategory,
    });
  }

  function pauseTimer() {
    void pauseSharedTimer();
  }

  function resumeTimer() {
    void resumeSharedTimer();
  }

  function stopTimer() {
    startTransition(() => {
      void stopSharedTimer();
    });
  }

  function resetTimer() {
    void discardSharedTimer();
    setTimerTitle("Focused study session");
    setTimerCategory("DSA");
  }

  function deleteEntry(id: string) {
    void deleteSharedEntry(id);
  }

  function exportEntries() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "careeros-time-entries.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Export started.");
  }

  function handleManualAdd(values: ManualEntryFormValues) {
    const startIso = combineDateAndTime(values.date, values.startTime);
    const endIso = combineDateAndTime(values.date, values.endTime);
    const duration = new Date(endIso).getTime() - new Date(startIso).getTime();

    void addManualEntry({
      title: values.title,
      category: values.category,
      startTime: startIso,
      endTime: endIso,
      duration,
      date: startIso,
    });

    manualForm.reset({
      title: "",
      category: values.category,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
    });
  }

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-surface animate-pulse rounded" />
        <div className="h-[300px] w-full bg-surface animate-pulse rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 pb-16">
      
      {/* ════════════ HEADER ════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-medium tracking-tight text-text-primary">
              Time Tracker
            </h1>
            <p className="mt-1 text-[15px] text-text-secondary">
              Live execution and historical logs.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {syncStatus !== "synced" && (
              <button
                type="button"
                onClick={() => void retrySync()}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-border bg-surface-raised text-accent hover:border-border-hover transition-colors"
              >
                {syncStatus === "syncing"
                  ? "Syncing..."
                  : syncStatus === "offline"
                    ? `Offline${pendingCount > 0 ? ` (${pendingCount})` : ""}`
                    : syncStatus === "pending"
                      ? `Pending Sync (${pendingCount})`
                      : "Sync Error · Retry"}
              </button>
            )}
            <Link 
              href="/time-tracker/sessions" 
              className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors border border-border bg-surface hover:bg-surface-raised px-4 py-1.5 rounded-md flex items-center gap-2"
            >
              View All Sessions &rarr;
            </Link>
            <div className="flex items-center gap-3">
              <button onClick={exportEntries} className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors">
                <Download className="h-4 w-4" /> Export
              </button>
              <span className="text-text-tertiary">|</span>
              <button 
                onClick={() => {
                  if (confirm("Reset all Time Tracker sessions?")) void resetWorkspace();
                }} 
                className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-10">
        
        {/* ════════════ HERO: LIVE TIMER ════════════ */}
        <motion.section variants={staggerItem} className="rounded-xl border border-border bg-surface shadow-card hover:border-border-hover hover:-translate-y-0.5 transition-all duration-200">
          
          <div className="p-8 flex flex-col md:flex-row items-center gap-10">
            {/* Clock Display */}
            <div className="shrink-0 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.06em]">Live Session</span>
                {activeTimer?.module === "english-communication" && (
                  <Link
                    href="/english-communication"
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-accent-subtle text-accent-text hover:opacity-90 transition-opacity"
                  >
                    English{activeTimer.subcategory ? ` · ${activeTimer.subcategory}` : ""}
                  </Link>
                )}
              </div>
              <div className="text-[64px] font-semibold text-text-primary tracking-tighter leading-none tabular-nums">
                {formatDuration(liveDuration)}
              </div>
              <div className="mt-4 flex items-center justify-center md:justify-start gap-4">
                {!activeTimer && (
                  <button onClick={startTimer} className="h-10 px-5 rounded-full bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                    <Play className="h-4 w-4 fill-current" /> Start
                  </button>
                )}
                {activeTimer?.status === "running" && (
                  <button onClick={pauseTimer} className="h-10 px-5 rounded-full bg-surface-raised border border-border text-text-primary text-[13px] font-semibold hover:border-border-hover transition-colors flex items-center gap-2">
                    <Pause className="h-4 w-4 fill-current" /> Pause
                  </button>
                )}
                {activeTimer?.status === "paused" && (
                  <button onClick={resumeTimer} className="h-10 px-5 rounded-full bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                    <Play className="h-4 w-4 fill-current" /> Resume
                  </button>
                )}
                {activeTimer && (
                  <>
                    <button onClick={stopTimer} className="h-10 px-5 rounded-full bg-surface-raised border border-border text-text-primary text-[13px] font-semibold hover:border-border-hover transition-colors flex items-center gap-2">
                      <Square className="h-4 w-4 fill-current" /> Stop
                    </button>
                    <button onClick={resetTimer} className="h-10 w-10 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Inputs */}
            <div className="flex-1 w-full flex flex-col gap-5 border-t border-border pt-6 md:pt-0 md:border-t-0 md:border-l md:pl-10">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text-tertiary">Session Objective</label>
                <input
                  type="text"
                  value={timerTitle}
                  onChange={(e) => {
                    setTimerTitle(e.target.value);
                    if (activeTimer) updateActiveTimerMeta({ title: e.target.value });
                  }}
                  className="w-full bg-transparent border-b border-border text-[20px] font-medium text-text-primary py-2 outline-none focus:border-accent transition-colors placeholder:text-text-tertiary"
                  placeholder="What are you working on?"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text-tertiary">Category</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {allCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setTimerCategory(cat);
                        if (activeTimer) updateActiveTimerMeta({ category: cat });
                      }}
                      className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors ${
                        timerCategory === cat 
                        ? "bg-accent-subtle text-accent-text" 
                        : "bg-surface-raised border border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  {isAddingCategory ? (
                    <form onSubmit={handleAddCustomCategory} className="flex items-center">
                      <input
                        autoFocus
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onBlur={() => {
                           if (!newCategoryName.trim()) setIsAddingCategory(false);
                        }}
                        className="h-7 w-28 px-2 bg-background border border-accent rounded-md text-[12px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        placeholder="New category"
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingCategory(true)}
                      className="h-7 px-2 rounded-md text-[12px] font-medium transition-colors bg-surface border border-border border-dashed text-text-secondary hover:text-text-primary flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ════════════ TWO COLUMN LAYOUT ════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
          
          {/* LEFT: Analytics */}
          <motion.div variants={staggerItem} className="flex flex-col gap-8">
            <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-[14px] font-medium text-text-primary">Performance Analytics</h2>
                  <div className="mt-2 flex items-center gap-4 text-[13px] text-text-secondary">
                    <div className="flex items-center gap-1.5"><span className="text-text-primary font-medium">{formatDuration(totalDuration)}</span> total</div>
                    <span className="text-text-tertiary">·</span>
                    <div className="flex items-center gap-1.5"><span className="text-text-primary font-medium">{formatDuration(avgDuration)}</span> avg</div>
                  </div>
                </div>
                
                <div className="flex gap-4 text-[12px] font-medium text-text-tertiary">
                  {periodOptions.map((p) => (
                    <button 
                      key={p} 
                      onClick={() => setSelectedPeriod(p)}
                      className={`transition-colors pb-1 ${selectedPeriod === p ? "text-text-primary border-b border-accent" : "hover:text-text-primary"}`}
                    >
                      {periodLabel(p)}
                    </button>
                  ))}
                </div>
              </div>

              {entries.length ? (
                <div className="grid gap-8 lg:grid-cols-2">
                  <ChartCard title="Daily" subtitle="Last 7 days" data={dailySeries} kind="line" />
                  <ChartCard title="Weekly" subtitle="Last 6 weeks" data={weeklySeries} kind="bar" />
                  <ChartCard title="Monthly" subtitle="Last 12 months" data={monthlySeries} kind="line" />
                  <ChartCard title="Distribution" subtitle="Lifetime mix" data={categorySeries} kind="pie" />
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center border border-dashed border-border rounded-lg text-text-tertiary">
                  <Clock3 className="h-8 w-8 mb-3 opacity-50" />
                  <p className="text-[13px]">No analytics data yet</p>
                </div>
              )}
            </section>
          </motion.div>

          {/* RIGHT: Logs and Forms */}
          <motion.div variants={staggerItem} className="flex flex-col gap-8">
            
            <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[14px] font-medium text-text-primary">Manual Entry</h2>
              </div>

              <form className="space-y-4" onSubmit={manualForm.handleSubmit(handleManualAdd)}>
                <div className="space-y-2">
                  <label className="text-[12px] font-medium text-text-secondary">Title</label>
                  <input type="text" {...manualForm.register("title")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 placeholder:text-text-tertiary transition-all" placeholder="E.g. System Design Mock" />
                  <FormError message={manualForm.formState.errors.title?.message} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-text-secondary">Category</label>
                    <select {...manualForm.register("category")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all">
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-text-secondary">Date</label>
                    <input type="date" {...manualForm.register("date")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-text-secondary">Start</label>
                    <input type="time" {...manualForm.register("startTime")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-text-secondary">End</label>
                    <input type="time" {...manualForm.register("endTime")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all" />
                  </div>
                </div>

                <button type="submit" disabled={isPending} className="w-full h-9 mt-2 bg-surface-raised border border-border rounded-md text-[13px] font-medium text-text-primary hover:border-border-hover transition-colors">
                  Log Session
                </button>
              </form>
            </section>

            <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-medium text-text-primary">Session Log</h2>
                <span className="text-[11px] font-medium bg-surface-raised px-2 py-0.5 rounded border border-border">{recentEntries.length} items</span>
              </div>

              {/* Dense List View — shows all sessions, not filtered by period */}
              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {recentEntries.length ? (
                    recentEntries.slice(0, 8).map((entry) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group flex flex-col py-3 border-b border-border last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[13px] font-medium text-text-primary truncate">{entry.title}</span>
                            <span className="text-[10px] uppercase tracking-wider text-accent shrink-0">
                              {entry.subcategory ? `${entry.category} · ${entry.subcategory}` : entry.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[12px] font-mono text-text-primary">{formatDuration(entry.duration)}</span>
                            <button onClick={() => deleteEntry(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] text-text-tertiary mt-1">
                          {formatDate(entry.date)} · {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-[12px] text-text-tertiary">No sessions logged.</div>
                  )}
                </AnimatePresence>
                {recentEntries.length > 8 && (
                  <Link href="/time-tracker/sessions" className="pt-3 text-[12px] text-accent text-center hover:underline block">
                    View all ({recentEntries.length}) &rarr;
                  </Link>
                )}
              </div>
            </section>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-destructive mt-1">{message}</p>;
}


