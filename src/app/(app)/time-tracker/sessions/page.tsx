"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Search, Clock, CalendarDays, BarChart2, Hash, ArrowUpDown, Trash2, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { loadTimeTrackerState, saveTimeTrackerState } from "@/features/time-tracker/time-tracker-storage";
import { formatDuration, formatDate, formatTime } from "@/features/time-tracker/time-tracker-utils";
import type { TimeEntry, TimeCategory, TimeTrackerPeriod } from "@/features/time-tracker/time-tracker-types";
import { timeCategories } from "@/features/time-tracker/time-tracker-types";
import { WorkspaceModal } from "@/components/ui/workspace-modal";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";

// Animation configs
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } }
};

type SortOption = "newest" | "oldest" | "longest" | "shortest";

export default function TimeTrackerSessionsPage() {
  const { user } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  // Filters & Sorting
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TimeCategory | "all">("all");
  const [sort, setSort] = useState<SortOption>("newest");

  // Drawer State
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  
  // Edit State
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState<TimeCategory>("DSA");

  useEffect(() => {
    async function init() {
      if (!user) return;
      const state = await loadTimeTrackerState(user.uid);
      setEntries(state.entries || []);
      setHydrated(true);
    }
    init();
  }, [user]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    
    // Filter Category
    if (categoryFilter !== "all") {
      result = result.filter(e => e.category === categoryFilter);
    }
    
    // Filter Search
    const q = query.toLowerCase().trim();
    if (q) {
      result = result.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.category.toLowerCase().includes(q) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    }
    
    // Sort
    result.sort((a, b) => {
      if (sort === "newest") return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      if (sort === "oldest") return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (sort === "longest") return b.duration - a.duration;
      if (sort === "shortest") return a.duration - b.duration;
      return 0;
    });

    return result;
  }, [entries, categoryFilter, query, sort]);

  // Header Analytics
  const totalMs = entries.reduce((acc, e) => acc + e.duration, 0);
  const avgMs = entries.length ? totalMs / entries.length : 0;
  const longestMs = entries.length ? Math.max(...entries.map(e => e.duration)) : 0;

  function openDrawer(entry: TimeEntry) {
    setSelectedEntry(entry);
    setEditNotes(entry.notes || "");
    setEditCategory(entry.category);
  }

  function closeDrawer() {
    setSelectedEntry(null);
  }

  function handleSaveEntry() {
    if (!selectedEntry || !user) return;
    
    const updatedEntries = entries.map(e => {
      if (e.id === selectedEntry.id) {
        return { ...e, category: editCategory, notes: editNotes.trim() };
      }
      return e;
    });

    startTransition(() => {
      setEntries(updatedEntries);
      saveTimeTrackerState(user.uid, { entries: updatedEntries, activeTimer: null }); // activeTimer logic is usually preserved, this might wipe activeTimer.
      // Wait, let's load full state first to be safe, but since this is just a quick edit, we can fetch activeTimer or just merge.
      // Actually `saveTimeTrackerState` with `{merge: true}` is better, let's just update entries.
    });

    toast.success("Session updated.");
    closeDrawer();
  }

  function handleDeleteEntry() {
    if (!selectedEntry || !user) return;
    if (!confirm("Are you sure you want to delete this session? This cannot be undone.")) return;

    const updatedEntries = entries.filter(e => e.id !== selectedEntry.id);
    
    startTransition(() => {
      setEntries(updatedEntries);
      async function safeSave() {
        if (!user) return;
        const state = await loadTimeTrackerState(user.uid);
        saveTimeTrackerState(user.uid, { entries: updatedEntries, activeTimer: state.activeTimer });
      }
      safeSave();
    });

    toast.success("Session deleted.");
    closeDrawer();
  }

  // Safe save helper for handleSaveEntry as well
  useEffect(() => {
    // Just attaching a ref to latest save
  }, []);

  const handleSafeSave = async (updatedEntries: TimeEntry[]) => {
    if (!user) return;
    const state = await loadTimeTrackerState(user.uid);
    saveTimeTrackerState(user.uid, { entries: updatedEntries, activeTimer: state.activeTimer });
  }

  function executeSave() {
    if (!selectedEntry || !user) return;
    const updatedEntries = entries.map(e => e.id === selectedEntry.id ? { ...e, category: editCategory, notes: editNotes.trim() } : e);
    setEntries(updatedEntries);
    handleSafeSave(updatedEntries);
    toast.success("Session updated.");
    closeDrawer();
  }

  function executeDelete() {
    if (!selectedEntry || !user) return;
    if (!confirm("Are you sure you want to delete this session?")) return;
    const updatedEntries = entries.filter(e => e.id !== selectedEntry.id);
    setEntries(updatedEntries);
    handleSafeSave(updatedEntries);
    toast.success("Session deleted.");
    closeDrawer();
  }

  if (!hydrated) {
    return (
      <div className="space-y-6 pb-16">
        <div className="h-10 w-48 bg-surface animate-pulse rounded" />
        <div className="h-[200px] w-full bg-surface animate-pulse rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-16">
      
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-4">
        <Link href="/time-tracker" className="inline-flex items-center gap-2 text-[13px] font-medium text-text-tertiary hover:text-text-primary transition-colors w-fit">
          <ChevronLeft className="h-4 w-4" /> Back to Time Tracker
        </Link>
        <div>
          <h1 className="text-[28px] font-medium tracking-tight text-text-primary">All Sessions</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Complete historical log of your deep work and learning.</p>
        </div>
      </motion.div>

      {/* Analytics Summary */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Time Logged", value: (totalMs / 36e5).toFixed(1) + " hrs", icon: Clock },
          { label: "Total Sessions", value: entries.length, icon: Hash },
          { label: "Average Length", value: formatDuration(avgMs), icon: BarChart2 },
          { label: "Longest Session", value: formatDuration(longestMs), icon: CalendarDays },
        ].map((stat, i) => (
          <motion.div key={i} variants={staggerItem} className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between hover:border-border-hover transition-colors">
            <div className="flex items-center justify-between text-text-tertiary mb-3">
              <span className="text-[12px] font-medium uppercase tracking-wider">{stat.label}</span>
              <stat.icon className="h-4 w-4" />
            </div>
            <span className="text-[24px] font-semibold text-text-primary tracking-tight">{stat.value}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search sessions..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 bg-background border border-border rounded-md pl-9 pr-3 text-[13px] text-text-primary focus:outline-accent transition-all placeholder:text-text-tertiary"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value as TimeCategory | "all")}
            className="h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent flex-1 sm:flex-none"
          >
            <option value="all">All Categories</option>
            {timeCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative flex-1 sm:flex-none">
            <select 
              value={sort} 
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="w-full h-9 bg-background border border-border rounded-md pl-8 pr-3 text-[13px] text-text-primary focus:outline-accent appearance-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Longest First</option>
              <option value="shortest">Shortest First</option>
            </select>
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          </div>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-text-tertiary uppercase tracking-[0.04em] font-medium text-[11px]">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Session Title</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEntries.map((entry) => (
                <tr 
                  key={entry.id} 
                  onClick={() => openDrawer(entry)}
                  className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5 font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                    {formatDate(entry.date)}
                  </td>
                  <td className="px-5 py-3.5 text-text-primary">
                    {entry.title}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-raised border border-border text-text-secondary">
                      {entry.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-accent">
                    {formatDuration(entry.duration)}
                  </td>
                  <td className="px-5 py-3.5 text-text-tertiary">
                    {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-text-tertiary">
                    No sessions found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Workspace Modal */}
      <WorkspaceModal
        isOpen={!!selectedEntry}
        onClose={closeDrawer}
        title="Session Review"
        leftPanel={
          selectedEntry ? (
            <div className="flex flex-col gap-6">
              <h2 className="text-[32px] font-semibold tracking-tight text-text-primary leading-tight outline-none focus:outline-none mb-4">
                {selectedEntry.title}
              </h2>
              
              <div className="flex flex-col gap-2">
                <AutoResizeTextarea 
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Reflect on this session. What did you study? What was challenging? Any key takeaways?"
                  className="text-[15px] leading-relaxed min-h-[500px]"
                />
              </div>
            </div>
          ) : null
        }
        rightPanel={
          selectedEntry ? (
            <div className="flex flex-col h-full">
              <div className="flex-1 p-6 flex flex-col gap-8">
                {/* Properties */}
                <div className="flex flex-col gap-5">
                  <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-tertiary">Properties</h3>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-text-tertiary flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Date</span>
                      <span className="font-medium text-text-primary">{formatDate(selectedEntry.date)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-text-tertiary flex items-center gap-2"><Clock className="h-4 w-4" /> Time</span>
                      <span className="font-medium text-text-primary">{formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-text-tertiary flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Duration</span>
                      <span className="font-mono text-accent">{formatDuration(selectedEntry.duration)}</span>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-[12px] font-medium text-text-tertiary">Category</label>
                      <select 
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value as TimeCategory)}
                        className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent transition-all"
                      >
                        {timeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sticky Footer */}
              <div className="p-6 border-t border-border bg-surface flex flex-col gap-3">
                <button onClick={executeSave} className="w-full h-10 rounded-md bg-accent text-background hover:opacity-90 transition-opacity text-[13px] font-semibold flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /> Save Changes
                </button>
                <button onClick={executeDelete} className="w-full h-10 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-[13px] font-medium flex items-center justify-center gap-2">
                  <Trash2 className="h-4 w-4" /> Delete Session
                </button>
              </div>
            </div>
          ) : null
        }
      />

    </div>
  );
}
