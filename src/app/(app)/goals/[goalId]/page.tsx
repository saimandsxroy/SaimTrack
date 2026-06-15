"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Save, Trash2, CalendarClock, CheckCircle2, Target, Plus, Circle, GripVertical } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { loadGoals, saveGoals } from "@/features/goal-tracker/goal-tracker-storage";
import type { Goal } from "@/features/goal-tracker/goal-tracker-types";
import { formatDate } from "@/features/time-tracker/time-tracker-utils";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";

export default function GoalDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const goalId = params?.goalId as string;

  const [hydrated, setHydrated] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  
  // Edit State
  const [notes, setNotes] = useState("");
  const [milestones, setMilestones] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newMilestone, setNewMilestone] = useState("");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function init() {
      if (!user || !goalId) return;
      const stored = await loadGoals(user.uid);
      setGoals(stored);
      
      const found = stored.find(g => g.id === goalId);
      if (found) {
        setGoal(found);
        setNotes(found.notes || "");
        setMilestones(found.milestones || []);
      }
      setHydrated(true);
    }
    init();
  }, [user, goalId]);

  function handleSave() {
    if (!goal || !user) return;
    
    // Auto calculate progress based on milestones if they exist
    let newProgress = goal.progress;
    if (milestones.length > 0) {
      const completedCount = milestones.filter(m => m.completed).length;
      newProgress = Math.round((completedCount / milestones.length) * 100);
    }

    const updatedGoal = {
      ...goal,
      notes: notes.trim(),
      milestones,
      progress: newProgress,
    };

    const nextGoals = goals.map(g => g.id === goalId ? updatedGoal : g);
    
    startTransition(() => {
      setGoals(nextGoals);
      setGoal(updatedGoal);
      saveGoals(user.uid, nextGoals);
    });
    
    toast.success("Goal saved.");
  }

  function handleCompleteGoal() {
    if (!goal || !user) return;
    if (!confirm("Mark this goal as fully completed and archive it?")) return;

    const updatedGoal = {
      ...goal,
      completed: true,
      progress: 100,
      completedAt: new Date().toISOString(),
    };

    const nextGoals = goals.map(g => g.id === goalId ? updatedGoal : g);
    
    startTransition(() => {
      saveGoals(user.uid, nextGoals);
    });
    
    toast.success("Goal completed! Moved to archives.");
    router.replace("/goals");
  }

  function handleDelete() {
    if (!goal || !user) return;
    if (!confirm("Are you sure you want to delete this goal entirely?")) return;

    const nextGoals = goals.filter(g => g.id !== goalId);
    
    startTransition(() => {
      saveGoals(user.uid, nextGoals);
    });
    
    toast.success("Goal deleted.");
    router.replace("/goals");
  }

  function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!newMilestone.trim()) return;
    setMilestones([...milestones, { id: crypto.randomUUID(), title: newMilestone.trim(), completed: false }]);
    setNewMilestone("");
  }

  function toggleMilestone(id: string) {
    setMilestones(milestones.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  }

  function deleteMilestone(id: string) {
    setMilestones(milestones.filter(m => m.id !== id));
  }

  if (!hydrated) {
    return (
      <div className="space-y-6 pb-16">
        <div className="h-10 w-48 bg-surface animate-pulse rounded" />
        <div className="h-[400px] w-full bg-surface animate-pulse rounded-xl border border-border" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-12 w-12 rounded-full bg-surface-raised flex items-center justify-center mb-4 border border-border">
          <Target className="h-6 w-6 text-text-tertiary" />
        </div>
        <h2 className="text-[16px] font-medium text-text-primary mb-2">Goal not found</h2>
        <p className="text-[13px] text-text-secondary mb-6">This goal may have been deleted or the URL is incorrect.</p>
        <Link href="/goals" className="h-9 px-4 rounded-md bg-surface border border-border text-text-primary hover:bg-surface-raised inline-flex items-center text-[13px] font-medium transition-colors">
          Return to Goals
        </Link>
      </div>
    );
  }

  const isCompleted = goal.completed;
  const computedProgress = milestones.length > 0 
    ? Math.round((milestones.filter(m => m.completed).length / milestones.length) * 100) 
    : goal.progress;

  return (
    <div className="flex flex-col gap-10 pb-16 max-w-5xl mx-auto w-full">
      
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-6">
        <Link href={isCompleted ? "/goals/completed" : "/goals"} className="inline-flex items-center gap-2 text-[13px] font-medium text-text-tertiary hover:text-text-primary transition-colors w-fit">
          <ChevronLeft className="h-4 w-4" /> Back to {isCompleted ? "Archives" : "Goals"}
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider ${
                goal.scope === 'Monthly' ? 'bg-accent/10 text-accent border-accent/20' :
                goal.scope === 'Quarterly' ? 'bg-[#CBA365]/10 text-[#CBA365] border-[#CBA365]/20' :
                'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}>
                {goal.scope}
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded uppercase tracking-wider">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              )}
            </div>
            <h1 className="text-[32px] font-semibold tracking-tight text-text-primary leading-tight">
              {goal.title}
            </h1>
            <div className="flex items-center gap-4 text-[13px] text-text-secondary">
              <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-text-tertiary" /> Deadline: {formatDate(goal.deadline)}</span>
              {isCompleted && goal.completedAt && (
                <>
                  <span className="text-text-tertiary">|</span>
                  <span className="text-text-primary">Achieved {formatDate(goal.completedAt)}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={handleDelete} className="h-9 px-3 rounded-md border border-border bg-surface text-text-secondary hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center">
              <Trash2 className="h-4 w-4" />
            </button>
            {!isCompleted && (
              <button onClick={handleSave} disabled={isPending} className="h-9 px-5 rounded-md bg-surface border border-border text-text-primary hover:bg-surface-raised transition-colors text-[13px] font-semibold flex items-center gap-2">
                <Save className="h-4 w-4" /> Save
              </button>
            )}
            {!isCompleted && (
              <button onClick={handleCompleteGoal} disabled={isPending} className="h-9 px-5 rounded-md bg-accent text-background hover:opacity-90 transition-opacity text-[13px] font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Mark Complete
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
        
        {/* Left Side: Document Editor (70%) */}
        <div className="flex-1 w-full flex flex-col gap-6">
          {isCompleted ? (
            <div className="w-full text-[15px] text-text-secondary leading-relaxed whitespace-pre-wrap">
              {notes || "No notes written for this goal."}
            </div>
          ) : (
            <AutoResizeTextarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Write your plan, thoughts, or markdown notes here... Even thousands of words."
              className="text-[16px] leading-relaxed tracking-normal"
              minHeight={600}
            />
          )}
        </div>

        {/* Right Side: Sidebar (30%) */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-8 lg:sticky lg:top-24">
          
          {/* Progress Overview */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-tertiary">Progress</h3>
            
            <div className="flex justify-between items-end">
              <span className="text-[32px] font-semibold tracking-tight text-text-primary leading-none">{computedProgress}%</span>
              <span className="text-[12px] text-text-secondary pb-1">{goal.target} Target</span>
            </div>
            <div className="h-2 w-full bg-surface-raised rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-success' : 'bg-accent'}`} 
                style={{ width: `${computedProgress}%` }}
              />
            </div>
          </div>

          <hr className="border-border" />

          {/* Milestones Checklist */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-tertiary">Milestones</h3>
            
            <div className="flex flex-col gap-1">
              {milestones.map((m, i) => (
                <div key={m.id} className="group flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                  <button 
                    disabled={isCompleted}
                    onClick={() => toggleMilestone(m.id)}
                    className="mt-1 shrink-0 text-text-tertiary hover:text-accent transition-colors disabled:opacity-50"
                  >
                    {m.completed ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <span className={`text-[14px] flex-1 leading-snug ${m.completed ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                    {m.title}
                  </span>
                  {!isCompleted && (
                    <button onClick={() => deleteMilestone(m.id)} className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-destructive transition-all mt-0.5">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {milestones.length === 0 && (
                <p className="text-[13px] text-text-tertiary italic">No milestones added.</p>
              )}
            </div>

            {!isCompleted && (
              <form onSubmit={addMilestone} className="mt-2 flex gap-2">
                <input 
                  type="text"
                  value={newMilestone}
                  onChange={e => setNewMilestone(e.target.value)}
                  placeholder="Add milestone..."
                  className="flex-1 h-9 bg-surface border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
                <button type="submit" disabled={!newMilestone.trim()} className="h-9 px-3 rounded-md bg-surface border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}

// Minimal X icon wrapper to avoid huge import
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );
}
