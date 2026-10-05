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
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import dynamic from "next/dynamic";

const ChartCard = dynamic(
  () => import("@/features/time-tracker/time-charts").then((mod) => mod.ChartCard),
  { ssr: false, loading: () => <div className="h-[212px] animate-pulse bg-surface-raised rounded-lg border border-border" /> }
);

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  defaultTimeTrackerState,
  loadTimeTrackerState,
  saveTimeTrackerState,
} from "@/features/time-tracker/time-tracker-storage";
import { useAuth } from "@/features/auth/auth-context";
import {
  timeCategories,
  type ActiveTimer,
  type TimeCategory,
  type TimeEntry,
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
  const { user } = useAuth();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [timerTitle, setTimerTitle] = useState("Focused study session");
  const [timerCategory, setTimerCategory] = useState<TimeCategory>("DSA");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const allCategories = useMemo(() => [...timeCategories, ...customCategories], [customCategories]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimeTrackerPeriod>("today");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TimeCategory | "all">("all");
  const [now, setNow] = useState(Date.now());
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
    async function init() {
      if (!user) return;
      const state = await loadTimeTrackerState(user.uid);
      setEntries(state.entries);
      setActiveTimer(state.activeTimer);
      setCustomCategories(state.customCategories || []);
      if (state.activeTimer) {
        setTimerTitle(state.activeTimer.title);
        setTimerCategory(state.activeTimer.category);
      }
      setHydrated(true);
    }
    init();
  }, [user]);

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") return;
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  const liveDuration = activeTimer
    ? activeTimer.accumulatedMs +
      (activeTimer.status === "running" ? now - new Date(activeTimer.runningSince).getTime() : 0)
    : 0;

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
  const dominantCategory = entryCount ? mostActiveCategory(analyticsEntries) : "Other";

  const dailySeries = buildDailySeries(entries);
  const weeklySeries = buildWeeklySeries(entries);
  const monthlySeries = buildMonthlySeries(entries);
  const categorySeries = buildCategorySeries(entries);

  function persist(nextEntries: TimeEntry[], nextTimer: ActiveTimer | null, nextCustomCategories = customCategories) {
    setEntries(nextEntries);
    setActiveTimer(nextTimer);
    setCustomCategories(nextCustomCategories);
    if (user) saveTimeTrackerState(user.uid, { entries: nextEntries, activeTimer: nextTimer, customCategories: nextCustomCategories });
  }

  function handleAddCustomCategory(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (trimmed && !allCategories.includes(trimmed)) {
      const nextCustomCategories = [...customCategories, trimmed];
      persist(entries, activeTimer, nextCustomCategories);
      setTimerCategory(trimmed);
    }
    setNewCategoryName("");
    setIsAddingCategory(false);
  }

  function startTimer() {
    if (activeTimer) return;
    const current = new Date();
    const timer: ActiveTimer = {
      id: crypto.randomUUID(),
      title: timerTitle.trim() || "Focused study session",
      category: timerCategory,
      startTime: current.toISOString(),
      runningSince: current.toISOString(),
      accumulatedMs: 0,
      status: "running",
    };
    persist(entries, timer);
    toast.success("Timer started.");
  }

  function pauseTimer() {
    if (!activeTimer || activeTimer.status !== "running") return;
    const elapsedMs =
      activeTimer.accumulatedMs + (Date.now() - new Date(activeTimer.runningSince).getTime());
    persist(
      entries,
      {
        ...activeTimer,
        accumulatedMs: elapsedMs,
        status: "paused",
      },
    );
    toast.success("Timer paused.");
  }

  function resumeTimer() {
    if (!activeTimer || activeTimer.status !== "paused") return;
    persist(
      entries,
      {
        ...activeTimer,
        runningSince: new Date().toISOString(),
        status: "running",
      },
    );
    toast.success("Timer resumed.");
  }

  function stopTimer() {
    if (!activeTimer) return;
    const completedDuration =
      activeTimer.accumulatedMs +
      (activeTimer.status === "running"
        ? Date.now() - new Date(activeTimer.runningSince).getTime()
        : 0);

    const completedEntry: TimeEntry = {
      id: activeTimer.id,
      title: activeTimer.title,
      category: activeTimer.category,
      startTime: activeTimer.startTime,
      endTime: new Date().toISOString(),
      duration: completedDuration,
      date: activeTimer.startTime,
    };

    startTransition(() => {
      const nextEntries = [completedEntry, ...entries];
      setEntries(nextEntries);
      setActiveTimer(null);
      if (user) saveTimeTrackerState(user.uid, { entries: nextEntries, activeTimer: null });
    });

    toast.success("Session saved.");
  }

  function resetTimer() {
    persist(entries, null);
    setTimerTitle("Focused study session");
    setTimerCategory("DSA");
    toast.message("Timer cleared.");
  }

  function deleteEntry(id: string) {
    const nextEntries = entries.filter((entry) => entry.id !== id);
    persist(nextEntries, activeTimer);
    toast.success("Session removed.");
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
    const duration = new Date(combineDateAndTime(values.date, values.endTime)).getTime() -
      new Date(combineDateAndTime(values.date, values.startTime)).getTime();

    const newEntry: TimeEntry = {
      id: crypto.randomUUID(),
      title: values.title,
      category: values.category,
      startTime: combineDateAndTime(values.date, values.startTime),
      endTime: combineDateAndTime(values.date, values.endTime),
      duration,
      date: combineDateAndTime(values.date, values.startTime),
    };

    persist([newEntry, ...entries], activeTimer);
    manualForm.reset({
      title: "",
      category: values.category,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
    });
    toast.success("Manual session added.");
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
          <div className="flex items-center gap-4">
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
                  setEntries(defaultTimeTrackerState.entries);
                  setActiveTimer(defaultTimeTrackerState.activeTimer);
                  toast.message("Workspace cleared.");
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
              <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.06em] mb-2">Live Session</div>
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
                    if (activeTimer) setActiveTimer(curr => curr ? { ...curr, title: e.target.value } : curr);
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
                        if (activeTimer) setActiveTimer(curr => curr ? { ...curr, category: cat } : curr);
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
                <span className="text-[11px] font-medium bg-surface-raised px-2 py-0.5 rounded border border-border">{visibleEntries.length} items</span>
              </div>

              {/* Dense List View */}
              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {visibleEntries.length ? (
                    visibleEntries.slice(0, 8).map((entry) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group flex flex-col py-3 border-b border-border last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[13px] font-medium text-text-primary truncate">{entry.title}</span>
                            <span className="text-[10px] uppercase tracking-wider text-accent shrink-0">{entry.category}</span>
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
                {visibleEntries.length > 8 && (
                  <Link href="/time-tracker/sessions" className="pt-3 text-[12px] text-accent text-center hover:underline block">
                    View all ({visibleEntries.length}) &rarr;
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


