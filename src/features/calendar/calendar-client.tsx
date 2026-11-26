"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Plus,
  Search,
  Trash2,
  Sparkles,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  buildCalendarGrid,
  createSeedEvents,
  formatMonthTitle,
  formatShortDate,
  formatWeekday,
  groupEventsByDate,
  toDateInputValue,
  toTimeInputValue,
} from "@/features/calendar/calendar-utils";
import {
  calendarEventTypes,
  type CalendarEvent,
  type CalendarEventType,
} from "@/features/calendar/calendar-types";
import {
  loadCalendarState,
  saveCalendarState,
} from "@/features/calendar/calendar-storage";
import { useAuth } from "@/features/auth/auth-context";
import { useTimeTracker } from "@/features/time-tracker/time-tracker-context";
import {
  allocateEntryAcrossDays,
  getDefaultTimezone,
  getEnglishEntries,
} from "@/features/english-communication/english-streak";
import { formatDuration } from "@/features/time-tracker/time-tracker-utils";

type EventFormValues = {
  title: string;
  type: CalendarEventType;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
};

const eventSchema = z
  .object({
    title: z.string().min(2, "Add a clear title."),
    type: z.enum(calendarEventTypes),
    date: z.string().min(1, "Pick a date."),
    startTime: z.string().min(1, "Start time is required."),
    endTime: z.string().min(1, "End time is required."),
    notes: z.string().min(3, "Add a short note."),
  })
  .refine((data) => `${data.date}T${data.endTime}` > `${data.date}T${data.startTime}`, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

// Monochromatic Theme (Grayscale safe)
const eventColors: Record<CalendarEventType, string> = {
  Study: "bg-text-primary",
  DSA: "bg-text-secondary",
  Jobs: "bg-text-tertiary",
  Learning: "bg-accent",
  Habits: "bg-accent/60",
  Goals: "bg-accent/40",
  Personal: "bg-border",
};

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

export function CalendarClient() {
  const { user } = useAuth();
  const { entries: timeEntries } = useTimeTracker();
  const [hydrated, setHydrated] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CalendarEventType | "all">("all");
  const [isPending, startTransition] = useTransition();

  const englishPracticeByDate = useMemo(() => {
    const timezone = getDefaultTimezone();
    const map = new Map<string, { durationMs: number; count: number }>();
    for (const entry of getEnglishEntries(timeEntries)) {
      const alloc = allocateEntryAcrossDays(entry, timezone);
      for (const [dateKey, ms] of alloc.entries()) {
        const prev = map.get(dateKey) ?? { durationMs: 0, count: 0 };
        map.set(dateKey, { durationMs: prev.durationMs + ms, count: prev.count + 1 });
      }
    }
    return map;
  }, [timeEntries]);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      type: "Study",
      date: toDateInputValue(new Date()),
      startTime: toTimeInputValue(new Date(Date.now() + 30 * 60 * 1000)),
      endTime: toTimeInputValue(new Date(Date.now() + 90 * 60 * 1000)),
      notes: "",
    },
  });

  useEffect(() => {
    async function init() {
      if (!user) return;
      const state = await loadCalendarState(user.uid);
      const nextEvents = state.events.length ? state.events : createSeedEvents(new Date());
      setEvents(nextEvents);
      setHydrated(true);
    }
    init();
  }, [user]);

  const eventGroups = useMemo(() => groupEventsByDate(events), [events]);
  const monthGrid = useMemo(() => buildCalendarGrid(selectedMonth), [selectedMonth]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events
      .filter((event) => (typeFilter === "all" ? true : event.type === typeFilter))
      .filter((event) => {
        if (!normalizedQuery) return true;
        return (
          event.title.toLowerCase().includes(normalizedQuery) ||
          event.notes.toLowerCase().includes(normalizedQuery) ||
          event.type.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort(
        (left, right) =>
          `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`),
      );
  }, [events, query, typeFilter]);

  const selectedEvents = useMemo(
    () => (eventGroups[selectedDate] ?? []).filter((event) => event.date === selectedDate),
    [eventGroups, selectedDate],
  );

  const monthEvents = useMemo(
    () =>
      events.filter((event) =>
        event.date.startsWith(`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`),
      ),
    [events, selectedMonth],
  );

  const upcomingCount = events.filter((event) => event.date >= toDateInputValue(new Date())).length;
  const busyDay = Object.entries(eventGroups).sort((left, right) => right[1].length - left[1].length)[0];
  const typeBreakdown = calendarEventTypes
    .map((type) => ({ type, count: events.filter((event) => event.type === type).length }))
    .filter((item) => item.count > 0);

  function persist(nextEvents: CalendarEvent[]) {
    const sorted = nextEvents.sort(
      (left, right) =>
        `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`),
    );
    setEvents(sorted);
    if (user) saveCalendarState(user.uid, { events: sorted });
  }

  function goToToday() {
    const today = new Date();
    setSelectedMonth(today);
    setSelectedDate(toDateInputValue(today));
  }

  function shiftMonth(delta: number) {
    setSelectedMonth((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  function addEvent(values: EventFormValues) {
    const nextEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: values.title.trim(),
      type: values.type,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      notes: values.notes.trim(),
      createdAt: new Date().toISOString(),
    };

    persist([...events, nextEvent]);
    setSelectedDate(values.date);
    form.reset({
      title: "",
      type: values.type,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      notes: "",
    });
    toast.success("Calendar event added.");
  }

  function removeEvent(eventId: string) {
    persist(events.filter((event) => event.id !== eventId));
    toast.success("Event removed.");
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
        <div>
          <h1 className="text-[28px] font-medium tracking-tight text-text-primary">
            Calendar
          </h1>
          <p className="mt-1 text-[15px] text-text-secondary">
            Command center for your schedule.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => shiftMonth(-1)} className="h-8 px-3 flex items-center justify-center text-[12px] font-medium text-text-secondary bg-surface-raised border border-border rounded hover:text-text-primary transition-colors">
            Prev
          </button>
          <button onClick={goToToday} className="h-8 px-3 flex items-center justify-center text-[12px] font-medium text-text-primary bg-surface-raised border border-border rounded hover:border-border-hover transition-colors">
            Today
          </button>
          <button onClick={() => shiftMonth(1)} className="h-8 px-3 flex items-center justify-center text-[12px] font-medium text-text-secondary bg-surface-raised border border-border rounded hover:text-text-primary transition-colors">
            Next
          </button>
        </div>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-10">
        
        {/* ════════════ TYPOGRAPHIC STATS ════════════ */}
        <motion.section variants={staggerItem} className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-y border-border">
          <div className="flex flex-col">
            <span className="text-[11px] text-accent uppercase tracking-widest font-medium mb-1">Upcoming</span>
            <span className="text-[28px] text-text-primary font-medium tracking-tight">{upcomingCount}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-text-secondary uppercase tracking-widest font-medium mb-1">This Month</span>
            <span className="text-[28px] text-text-primary font-medium tracking-tight">{monthEvents.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-text-secondary uppercase tracking-widest font-medium mb-1">Busiest Day</span>
            <span className="text-[28px] text-text-primary font-medium tracking-tight">{busyDay ? formatShortDate(busyDay[0]) : "—"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-text-tertiary uppercase tracking-widest font-medium mb-1">Focus Lanes</span>
            <span className="text-[28px] text-text-primary font-medium tracking-tight">{typeBreakdown.length}</span>
          </div>
        </motion.section>

        {/* ════════════ TWO COLUMN LAYOUT ════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-8">
          
          {/* LEFT: Calendar Grid */}
          <motion.div variants={staggerItem} className="flex flex-col gap-8">
            <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[18px] font-medium text-text-primary">{formatMonthTitle(selectedMonth)}</h2>
              </div>

              <div className="grid grid-cols-7 gap-2 text-[11px] font-medium uppercase tracking-widest text-text-tertiary mb-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {monthGrid.map((day) => {
                  const dayEvents = eventGroups[day.key] ?? [];
                  const englishActivity = englishPracticeByDate.get(day.key);
                  const isSelected = selectedDate === day.key;

                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDate(day.key)}
                      className={`min-h-[100px] rounded-lg border p-2 text-left transition-all ${
                        isSelected
                          ? "border-accent bg-accent/5 ring-1 ring-accent"
                          : "border-border bg-background hover:border-border-hover"
                      } ${day.inCurrentMonth ? "" : "opacity-30"}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-[13px] font-medium ${day.isToday ? "text-accent underline underline-offset-4" : "text-text-primary"}`}>
                          {day.date.getDate()}
                        </span>
                        <div className="flex items-center gap-1">
                          {englishActivity && englishActivity.durationMs > 0 && (
                            <span
                              className="text-[9px] font-mono px-1 py-0.5 rounded bg-accent-subtle text-accent-text"
                              title={`English practice: ${formatDuration(englishActivity.durationMs)}`}
                            >
                              EN {Math.round(englishActivity.durationMs / 60000)}m
                            </span>
                          )}
                          {dayEvents.length > 0 && (
                            <span className="text-[10px] font-medium text-text-tertiary">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-3 flex flex-wrap gap-1">
                        {dayEvents.slice(0, 4).map((event) => (
                          <span
                            key={event.id}
                            className={`h-1.5 w-1.5 rounded-full ${eventColors[event.type]}`}
                            title={event.title}
                          />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-border" title="More events" />
                        )}
                      </div>
                      
                      <p className="mt-2 line-clamp-1 text-[10px] text-text-secondary truncate">
                        {dayEvents[0]?.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          </motion.div>

          {/* RIGHT: Schedule & Add Event */}
          <motion.div variants={staggerItem} className="flex flex-col gap-8">
            <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
              <div className="mb-6 pb-6 border-b border-border">
                <h2 className="text-[16px] font-medium text-text-primary">
                  {formatWeekday(new Date(selectedDate))}
                </h2>
                <p className="text-[12px] text-text-secondary mt-1">
                  {formatShortDate(selectedDate)}
                </p>
                {(() => {
                  const activity = englishPracticeByDate.get(selectedDate);
                  if (!activity || activity.durationMs <= 0) return null;
                  return (
                    <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-accent-subtle px-3 py-2 text-[12px]">
                      <span className="font-medium text-accent-text">English Practice</span>
                      <span className="font-mono text-text-primary">
                        {formatDuration(activity.durationMs)} · {activity.count} session{activity.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-col">
                <AnimatePresence initial={false}>
                  {selectedEvents.length ? (
                    selectedEvents.map((event) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="group flex flex-col py-4 border-b border-border last:border-0"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col min-w-0 pr-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${eventColors[event.type]}`} />
                              <span className="text-[13px] font-medium text-text-primary truncate">{event.title}</span>
                            </div>
                            <span className="text-[11px] text-text-tertiary mt-1.5 ml-4.5">
                              {event.type} · {event.startTime}–{event.endTime}
                            </span>
                            {event.notes && (
                              <p className="text-[11px] text-text-secondary mt-2 ml-4.5 italic border-l-2 border-border pl-2 line-clamp-2">
                                {event.notes}
                              </p>
                            )}
                          </div>
                          
                          <button onClick={() => removeEvent(event.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-destructive shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-[12px] text-text-tertiary">No events scheduled.</div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-[12px] font-medium text-text-primary mb-4">Add Event</h3>
                <form className="space-y-4" onSubmit={form.handleSubmit((values) => startTransition(() => addEvent(values)))}>
                  <div className="space-y-2">
                    <input type="text" {...form.register("title")} className="w-full bg-transparent border-b border-border text-[16px] font-medium text-text-primary py-2 outline-none focus:border-accent transition-colors placeholder:text-text-tertiary" placeholder="Event Title..." />
                    <FormError message={form.formState.errors.title?.message} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[12px] font-medium text-text-secondary">Type</label>
                      <select {...form.register("type")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all">
                        {calendarEventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-medium text-text-secondary">Date</label>
                      <input type="date" {...form.register("date")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[12px] font-medium text-text-secondary">Start</label>
                      <input type="time" {...form.register("startTime")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[12px] font-medium text-text-secondary">End</label>
                      <input type="time" {...form.register("endTime")} className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all" />
                      <FormError message={form.formState.errors.endTime?.message} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-medium text-text-secondary">Notes (Optional)</label>
                    <textarea {...form.register("notes")} className="w-full h-16 bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 placeholder:text-text-tertiary transition-all resize-none" placeholder="Context..." />
                  </div>

                  <button type="submit" disabled={isPending} className="w-full h-9 mt-2 bg-accent text-background rounded-md text-[13px] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" /> Save
                  </button>
                </form>
              </div>
            </section>
          </motion.div>
        </div>

        {/* ════════════ PLANNER LIST ════════════ */}
        <motion.div variants={staggerItem} className="flex flex-col gap-8">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-card hover:border-border-hover transition-all duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 border-b border-border pb-6">
              <h2 className="text-[14px] font-medium text-text-primary">Master Planner</h2>
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="text"
                    className="w-full sm:w-64 h-9 bg-background border border-border rounded-md pl-9 pr-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 placeholder:text-text-tertiary transition-all"
                    placeholder="Search all events..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <select
                  className="h-9 w-full sm:w-40 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline focus:outline-2 focus:outline-accent outline-offset-0 transition-all"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as CalendarEventType | "all")}
                >
                  <option value="all">All Types</option>
                  {calendarEventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="group flex flex-col p-4 rounded-lg border border-border bg-background hover:border-border-hover transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${eventColors[event.type]}`} />
                          <h3 className="text-[13px] font-medium text-text-primary truncate">{event.title}</h3>
                        </div>
                        <p className="mt-1 text-[11px] text-text-secondary">
                          {event.type} · {formatShortDate(event.date)} · {event.startTime}–{event.endTime}
                        </p>
                        {event.notes && (
                          <p className="mt-2 text-[11px] text-text-tertiary italic line-clamp-2">
                            &quot;{event.notes}&quot;
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeEvent(event.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredEvents.length === 0 && (
                <div className="col-span-full py-12 text-center text-[12px] text-text-tertiary">
                  No events found.
                </div>
              )}
            </div>
          </section>
        </motion.div>
      </motion.div>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-destructive mt-1">{message}</p>;
}
