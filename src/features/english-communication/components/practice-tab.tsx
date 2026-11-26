"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Edit3,
  Pause,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Drawer } from "@/components/ui/drawer";
import { useTimeTracker } from "@/features/time-tracker/time-tracker-context";
import {
  combineDateAndTime,
  formatDate,
  formatDuration,
  formatTime,
  toDateInputValue,
  toTimeInputValue,
} from "@/features/time-tracker/time-tracker-utils";
import type { TimeEntry } from "@/features/time-tracker/time-tracker-types";
import {
  ENGLISH_MODULE_ID,
  englishPracticeCategories,
  type EnglishPracticeCategory,
} from "@/features/english-communication/english-types";
import { getEnglishEntries } from "@/features/english-communication/english-streak";

type ManualEnglishFormValues = {
  title: string;
  subcategory: EnglishPracticeCategory;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
};

const manualEnglishSchema = z
  .object({
    title: z.string().min(2, "Add a descriptive session objective."),
    subcategory: z.enum(englishPracticeCategories),
    date: z.string().min(1, "Pick a date."),
    startTime: z.string().min(1, "Start time is required."),
    endTime: z.string().min(1, "End time is required."),
    notes: z.string(),
  })
  .refine(
    (data) =>
      combineDateAndTime(data.date, data.endTime) > combineDateAndTime(data.date, data.startTime),
    {
      message: "End time must be after start time.",
      path: ["endTime"],
    },
  );

type PracticeTabProps = {
  onSessionSaved?: (savedEntry: TimeEntry) => void;
  prefillTitle?: string;
  prefillCategory?: EnglishPracticeCategory;
  compactTimerOnly?: boolean;
};

export function PracticeTab({
  onSessionSaved,
  prefillTitle,
  prefillCategory,
  compactTimerOnly = false,
}: PracticeTabProps) {
  const {
    entries,
    activeTimer,
    liveDuration,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    discardTimer,
    updateActiveTimerMeta,
    addManualEntry,
    updateEntry,
    deleteEntry,
  } = useTimeTracker();

  const [sessionTitle, setSessionTitle] = useState(prefillTitle || "Focused English practice");
  const [practiceCategory, setPracticeCategory] = useState<EnglishPracticeCategory>(
    prefillCategory || "Speaking",
  );
  const [sessionNotes, setSessionNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubcategory, setEditSubcategory] = useState<EnglishPracticeCategory>("Speaking");
  const [editNotes, setEditNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (prefillTitle) setSessionTitle(prefillTitle);
  }, [prefillTitle]);

  useEffect(() => {
    if (prefillCategory) setPracticeCategory(prefillCategory);
  }, [prefillCategory]);

  const isEnglishTimerActive = activeTimer?.module === ENGLISH_MODULE_ID;
  const isOtherTimerActive = Boolean(activeTimer && activeTimer.module !== ENGLISH_MODULE_ID);

  useEffect(() => {
    if (activeTimer && activeTimer.module === ENGLISH_MODULE_ID) {
      setSessionTitle(activeTimer.title);
      if (
        activeTimer.subcategory &&
        (englishPracticeCategories as readonly string[]).includes(activeTimer.subcategory)
      ) {
        setPracticeCategory(activeTimer.subcategory as EnglishPracticeCategory);
      }
      setSessionNotes(activeTimer.notes || "");
    }
  }, [activeTimer?.id]);

  const manualForm = useForm<ManualEnglishFormValues>({
    resolver: zodResolver(manualEnglishSchema),
    defaultValues: {
      title: "",
      subcategory: "Speaking",
      date: toDateInputValue(new Date()),
      startTime: toTimeInputValue(new Date(Date.now() - 30 * 60 * 1000)),
      endTime: toTimeInputValue(new Date()),
      notes: "",
    },
  });

  const englishSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return getEnglishEntries(entries)
      .filter((e) => (categoryFilter === "all" ? true : e.subcategory === categoryFilter))
      .filter((e) => {
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          (e.subcategory || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [entries, searchQuery, categoryFilter]);

  async function handleStart() {
    await startTimer({
      title: sessionTitle.trim() || `${practiceCategory} Practice`,
      category: "Communication",
      module: ENGLISH_MODULE_ID,
      subcategory: practiceCategory,
      notes: sessionNotes.trim(),
    });
  }

  async function handleStopAndSave() {
    const saved = await stopTimer();
    if (saved && saved.module === ENGLISH_MODULE_ID) {
      setSessionNotes("");
      onSessionSaved?.(saved);
    }
  }

  async function handleManualSubmit(values: ManualEnglishFormValues) {
    const startIso = combineDateAndTime(values.date, values.startTime);
    const endIso = combineDateAndTime(values.date, values.endTime);
    const duration = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());

    const saved = await addManualEntry({
      title: values.title.trim(),
      category: "Communication",
      module: ENGLISH_MODULE_ID,
      subcategory: values.subcategory,
      startTime: startIso,
      endTime: endIso,
      duration,
      date: startIso,
      notes: values.notes.trim() || undefined,
    });

    if (saved) {
      onSessionSaved?.(saved);
      manualForm.reset({
        title: "",
        subcategory: values.subcategory,
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        notes: "",
      });
    }
  }

  function openEditDrawer(entry: TimeEntry) {
    setEditingEntry(entry);
    setEditTitle(entry.title);
    setEditSubcategory(
      (englishPracticeCategories as readonly string[]).includes(entry.subcategory || "")
        ? (entry.subcategory as EnglishPracticeCategory)
        : "Speaking",
    );
    setEditNotes(entry.notes || "");
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;
    await updateEntry({
      ...editingEntry,
      title: editTitle.trim() || editingEntry.title,
      subcategory: editSubcategory,
      notes: editNotes.trim(),
    });
    setEditingEntry(null);
  }

  const timerHero = (
    <section className="rounded-xl border border-border bg-surface shadow-card hover:border-border-hover transition-all duration-200">
      {isOtherTimerActive && activeTimer && (
        <div className="border-b border-border bg-accent-subtle px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[13px] text-text-primary">
            <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
            <span>
              An active <strong>{activeTimer.category}</strong> session (&quot;{activeTimer.title}&quot;) is
              running in Time Tracker ({formatDuration(liveDuration)}).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void stopTimer()}
              className="h-7 px-3 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 transition-opacity"
            >
              Finish Current
            </button>
            <Link
              href="/time-tracker"
              className="h-7 px-3 rounded-md border border-border bg-surface text-[12px] font-medium text-text-primary hover:border-border-hover flex items-center gap-1"
            >
              Open Timer <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      <div className="p-6 md:p-8 flex flex-col lg:flex-row items-center gap-8">
        {/* Clock Display */}
        <div className="shrink-0 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.06em]">
              English Practice Session
            </span>
            {isEnglishTimerActive && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-accent-subtle text-accent-text">
                {activeTimer?.status === "paused" ? "Paused" : "Live"}
              </span>
            )}
          </div>
          <div className="text-[56px] sm:text-[64px] font-semibold text-text-primary tracking-tighter leading-none tabular-nums">
            {isEnglishTimerActive ? formatDuration(liveDuration) : "00:00:00"}
          </div>
          <div className="mt-4 flex items-center justify-center lg:justify-start gap-3">
            {!activeTimer && (
              <button
                type="button"
                onClick={handleStart}
                className="h-10 px-5 rounded-full bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" /> Start Practice
              </button>
            )}
            {isEnglishTimerActive && activeTimer?.status === "running" && (
              <button
                type="button"
                onClick={() => void pauseTimer()}
                className="h-10 px-5 rounded-full bg-surface-raised border border-border text-text-primary text-[13px] font-semibold hover:border-border-hover transition-colors flex items-center gap-2"
              >
                <Pause className="h-4 w-4 fill-current" /> Pause
              </button>
            )}
            {isEnglishTimerActive && activeTimer?.status === "paused" && (
              <button
                type="button"
                onClick={() => void resumeTimer()}
                className="h-10 px-5 rounded-full bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Play className="h-4 w-4 fill-current" /> Resume
              </button>
            )}
            {isEnglishTimerActive && (
              <>
                <button
                  type="button"
                  onClick={() => startTransition(() => void handleStopAndSave())}
                  className="h-10 px-5 rounded-full bg-surface-raised border border-border text-text-primary text-[13px] font-semibold hover:border-border-hover transition-colors flex items-center gap-2"
                >
                  <Square className="h-4 w-4 fill-current" /> Stop &amp; Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Discard this active English session without saving?")) {
                      void discardTimer();
                    }
                  }}
                  title="Discard active session"
                  aria-label="Discard active session"
                  className="h-10 w-10 flex items-center justify-center rounded-full text-text-tertiary hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="flex-1 w-full flex flex-col gap-4 border-t border-border pt-6 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-text-tertiary">Session Objective</label>
              <input
                type="text"
                value={sessionTitle}
                disabled={isOtherTimerActive}
                onChange={(e) => {
                  setSessionTitle(e.target.value);
                  if (isEnglishTimerActive) updateActiveTimerMeta({ title: e.target.value });
                }}
                className="w-full bg-transparent border-b border-border text-[17px] font-medium text-text-primary py-1.5 outline-none focus:border-accent transition-colors placeholder:text-text-tertiary disabled:opacity-50"
                placeholder="E.g. Mock behavioral interview answers"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-text-tertiary">Session Notes (Optional)</label>
              <input
                type="text"
                value={sessionNotes}
                disabled={isOtherTimerActive}
                onChange={(e) => {
                  setSessionNotes(e.target.value);
                  if (isEnglishTimerActive) updateActiveTimerMeta({ notes: e.target.value });
                }}
                className="w-full bg-transparent border-b border-border text-[14px] text-text-primary py-2 outline-none focus:border-accent transition-colors placeholder:text-text-tertiary disabled:opacity-50"
                placeholder="Key focus, feedback, or expressions used..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-medium text-text-tertiary">
              Practice Category <span className="text-text-tertiary/70">(Logged under Communication)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {englishPracticeCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  disabled={isOtherTimerActive}
                  onClick={() => {
                    setPracticeCategory(cat);
                    if (isEnglishTimerActive) updateActiveTimerMeta({ subcategory: cat });
                  }}
                  className={`h-7 px-2.5 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-50 ${
                    practiceCategory === cat
                      ? "bg-accent-subtle text-accent-text border border-accent/30"
                      : "bg-surface-raised border border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  if (compactTimerOnly) {
    return timerHero;
  }

  return (
    <div className="flex flex-col gap-8">
      {timerHero}

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-8">
        {/* Manual Session Entry */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-medium text-text-primary">Manual English Session</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Log offline conversations, classes, or reading sessions.
              </p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={manualForm.handleSubmit((vals) => startTransition(() => void handleManualSubmit(vals)))}
          >
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-text-secondary">Session Objective</label>
              <input
                type="text"
                {...manualForm.register("title")}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
                placeholder="E.g. 1-on-1 mentor speaking session"
              />
              {manualForm.formState.errors.title && (
                <p className="text-[11px] text-destructive">{manualForm.formState.errors.title.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Practice Category</label>
                <select
                  {...manualForm.register("subcategory")}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                >
                  {englishPracticeCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Date</label>
                <input
                  type="date"
                  {...manualForm.register("date")}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Start Time</label>
                <input
                  type="time"
                  {...manualForm.register("startTime")}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">End Time</label>
                <input
                  type="time"
                  {...manualForm.register("endTime")}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
                {manualForm.formState.errors.endTime && (
                  <p className="text-[11px] text-destructive">
                    {manualForm.formState.errors.endTime.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-text-secondary">Notes (Optional)</label>
              <textarea
                {...manualForm.register("notes")}
                rows={2}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent placeholder:text-text-tertiary resize-none"
                placeholder="What did you practice or notice?"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-9 bg-accent text-background rounded-md text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" /> Log English Session
            </button>
          </form>
        </section>

        {/* English Session History */}
        <section className="rounded-xl border border-border bg-surface p-6 shadow-card flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-[15px] font-medium text-text-primary">English Session History</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Synced directly with Time Tracker ({englishSessions.length} sessions).
              </p>
            </div>
            <Link
              href="/time-tracker/sessions"
              className="text-[12px] font-medium text-accent hover:underline"
            >
              Global History &rarr;
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search English sessions..."
                className="w-full h-9 bg-background border border-border rounded-md pl-8 pr-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
            >
              <option value="all">All Practice Types</option>
              {englishPracticeCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[420px] pr-1">
            <AnimatePresence initial={false}>
              {englishSessions.length > 0 ? (
                englishSessions.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group flex flex-col py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-medium text-text-primary truncate">
                          {entry.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent-text shrink-0">
                          {entry.subcategory || "Communication"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[12px] font-mono text-text-primary">
                          {formatDuration(entry.duration)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditDrawer(entry)}
                          aria-label="Edit session"
                          className="opacity-70 group-hover:opacity-100 text-text-tertiary hover:text-accent transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Delete this English session?")) void deleteEntry(entry.id);
                          }}
                          aria-label="Delete session"
                          className="opacity-70 group-hover:opacity-100 text-text-tertiary hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-1">
                      {formatDate(entry.date)} · {formatTime(entry.startTime)} –{" "}
                      {formatTime(entry.endTime)}
                    </div>
                    {entry.notes && (
                      <p className="text-[11.5px] text-text-secondary mt-1.5 border-l-2 border-border pl-2">
                        {entry.notes}
                      </p>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center text-text-tertiary border border-dashed border-border rounded-lg">
                  <Clock3 className="h-7 w-7 mb-2 opacity-50" />
                  <p className="text-[12px]">No English sessions match your filter yet.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* Edit Session Drawer */}
      <Drawer
        isOpen={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        title="Edit English Session"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingEntry(null)}
              className="h-9 px-4 rounded-md border border-border text-[13px] text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              className="h-9 px-4 rounded-md bg-accent text-background text-[13px] font-semibold hover:opacity-90"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-secondary">Session Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-secondary">Practice Category</label>
            <select
              value={editSubcategory}
              onChange={(e) => setEditSubcategory(e.target.value as EnglishPracticeCategory)}
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            >
              {englishPracticeCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-secondary">Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={5}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
