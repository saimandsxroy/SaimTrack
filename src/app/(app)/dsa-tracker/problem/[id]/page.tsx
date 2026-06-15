"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Save, Trash2, CalendarClock, History, CheckCircle2, Link as LinkIcon, BookOpen, AlertTriangle, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import { loadDsaProblems, saveDsaProblems } from "@/features/dsa-tracker/dsa-tracker-storage";
import type { DsaProblem } from "@/features/dsa-tracker/dsa-tracker-types";
import { formatSolvedDate } from "@/features/dsa-tracker/dsa-tracker-utils";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";

export default function DsaProblemDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [hydrated, setHydrated] = useState(false);
  const [problems, setProblems] = useState<DsaProblem[]>([]);
  const [problem, setProblem] = useState<DsaProblem | null>(null);
  
  // Edit State
  const [notes, setNotes] = useState("");
  const [learningSummary, setLearningSummary] = useState("");
  const [mistakesMade, setMistakesMade] = useState("");
  const [approachUsed, setApproachUsed] = useState("");
  const [revisionRequired, setRevisionRequired] = useState(false);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function init() {
      if (!user || !id) return;
      const stored = await loadDsaProblems(user.uid);
      setProblems(stored);
      
      const found = stored.find(p => p.id === id);
      if (found) {
        setProblem(found);
        setNotes(found.notes || "");
        setLearningSummary(found.learningSummary || "");
        setMistakesMade(found.mistakesMade || "");
        setApproachUsed(found.approachUsed || "");
        setRevisionRequired(found.revisionRequired);
      }
      setHydrated(true);
    }
    init();
  }, [user, id]);

  function handleSave() {
    if (!problem || !user) return;
    
    const updatedProblem = {
      ...problem,
      notes: notes.trim(),
      learningSummary: learningSummary.trim(),
      mistakesMade: mistakesMade.trim(),
      approachUsed: approachUsed.trim(),
      revisionRequired
    };

    const nextProblems = problems.map(p => p.id === id ? updatedProblem : p);
    
    startTransition(() => {
      setProblems(nextProblems);
      setProblem(updatedProblem);
      saveDsaProblems(user.uid, nextProblems);
    });
    
    toast.success("Problem notes saved.");
  }

  function handleLogRevision() {
    if (!problem || !user) return;
    
    const today = new Date().toISOString();
    const newRevisions = [...(problem.revisions || []), { date: today }];
    // Optionally auto-clear revision required flag when revising
    const updatedProblem = {
      ...problem,
      revisions: newRevisions,
      revisionRequired: false
    };

    const nextProblems = problems.map(p => p.id === id ? updatedProblem : p);
    
    startTransition(() => {
      setProblems(nextProblems);
      setProblem(updatedProblem);
      setRevisionRequired(false);
      saveDsaProblems(user.uid, nextProblems);
    });
    
    toast.success("Revision logged successfully.");
  }

  function handleDelete() {
    if (!problem || !user) return;
    if (!confirm("Are you sure you want to delete this problem from your log?")) return;

    const nextProblems = problems.filter(p => p.id !== id);
    
    startTransition(() => {
      saveDsaProblems(user.uid, nextProblems);
    });
    
    toast.success("Problem deleted.");
    router.replace("/dsa-tracker/problems");
  }

  if (!hydrated) {
    return (
      <div className="space-y-6 pb-16">
        <div className="h-10 w-48 bg-surface animate-pulse rounded" />
        <div className="h-[400px] w-full bg-surface animate-pulse rounded-xl border border-border" />
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-12 w-12 rounded-full bg-surface-raised flex items-center justify-center mb-4 border border-border">
          <AlertTriangle className="h-6 w-6 text-text-tertiary" />
        </div>
        <h2 className="text-[16px] font-medium text-text-primary mb-2">Problem not found</h2>
        <p className="text-[13px] text-text-secondary mb-6">This problem may have been deleted or the URL is incorrect.</p>
        <Link href="/dsa-tracker/problems" className="h-9 px-4 rounded-md bg-surface border border-border text-text-primary hover:bg-surface-raised inline-flex items-center text-[13px] font-medium transition-colors">
          Return to Problem Log
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-16 max-w-5xl mx-auto w-full">
      
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-col gap-6">
        <Link href="/dsa-tracker/problems" className="inline-flex items-center gap-2 text-[13px] font-medium text-text-tertiary hover:text-text-primary transition-colors w-fit">
          <ChevronLeft className="h-4 w-4" /> Back to Log
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider ${
                problem.difficulty === 'Easy' ? 'bg-surface-raised text-text-secondary border-border' :
                problem.difficulty === 'Medium' ? 'bg-accent/10 text-accent border-accent/20' :
                'bg-[#CBA365]/10 text-[#CBA365] border-[#CBA365]/20'
              }`}>
                {problem.difficulty}
              </span>
              <span className="text-[12px] font-medium text-text-tertiary px-2 py-0.5 rounded bg-surface border border-border">{problem.platform}</span>
            </div>
            <h1 className="text-[32px] font-semibold tracking-tight text-text-primary leading-tight">
              {problem.name}
            </h1>
            <div className="flex items-center gap-4 text-[13px] text-text-secondary">
              <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-text-tertiary" /> {problem.topic}</span>
              <span className="text-text-tertiary">|</span>
              <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-text-tertiary" /> Solved {formatSolvedDate(problem.solvedDate)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={handleDelete} className="h-9 px-3 rounded-md border border-border bg-surface text-text-secondary hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={handleSave} disabled={isPending} className="h-9 px-5 rounded-md bg-accent text-background hover:opacity-90 transition-opacity text-[13px] font-semibold flex items-center gap-2">
              <Save className="h-4 w-4" /> Save Notes
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">
        
        {/* Left Side (70%) - Document Editor */}
        <div className="flex-1 w-full flex flex-col gap-12">
          
          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] font-medium text-text-primary flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent" /> Approach & Intuition
            </h2>
            <AutoResizeTextarea 
              value={approachUsed}
              onChange={e => setApproachUsed(e.target.value)}
              placeholder="How did you solve this? What algorithm or data structure was the key?"
              className="text-[15px] leading-relaxed tracking-normal"
              minHeight={150}
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] font-medium text-text-primary flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> Mistakes & Edge Cases
            </h2>
            <AutoResizeTextarea 
              value={mistakesMade}
              onChange={e => setMistakesMade(e.target.value)}
              placeholder="Did you miss any edge cases? TLE? Bugs?"
              className="text-[15px] leading-relaxed tracking-normal"
              minHeight={150}
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] font-medium text-text-primary flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-success" /> Key Takeaways
            </h2>
            <AutoResizeTextarea 
              value={learningSummary}
              onChange={e => setLearningSummary(e.target.value)}
              placeholder="Summarize the core concept learned here so you can review it later."
              className="text-[15px] leading-relaxed tracking-normal"
              minHeight={150}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] font-medium text-text-primary flex items-center gap-2">
              <History className="h-5 w-5 text-text-tertiary" /> Scratchpad Notes
            </h2>
            <AutoResizeTextarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Raw notes from your session..."
              className="text-[15px] leading-relaxed tracking-normal"
              minHeight={150}
            />
          </div>

        </div>

        {/* Right Side (30%) - Properties Sidebar */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-8 lg:sticky lg:top-24">
          <div className="flex flex-col gap-6">
            <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-text-tertiary">Revision Control</h3>
            
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="flex h-5 items-center">
                <input 
                  type="checkbox" 
                  checked={revisionRequired}
                  onChange={e => setRevisionRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-text-primary group-hover:text-accent transition-colors">Needs Revision</span>
                <span className="text-[12px] text-text-tertiary leading-snug mt-0.5">Mark this if you struggled and want to re-attempt it later.</span>
              </div>
            </label>

            <hr className="border-border" />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-text-secondary">Total Revisions</span>
                <span className="text-[14px] font-semibold text-text-primary bg-surface-raised px-2 py-0.5 rounded border border-border">
                  {problem.revisions?.length || 0}
                </span>
              </div>
              
              <button 
                onClick={handleLogRevision}
                className="w-full h-9 rounded-md border border-border bg-background text-text-primary hover:bg-surface-raised transition-colors text-[13px] font-medium flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Log Revision Today
              </button>
            </div>

            {problem.revisions && problem.revisions.length > 0 && (
              <div className="flex flex-col gap-2 mt-4">
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1">History</span>
                {problem.revisions.map((rev, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[13px] text-text-secondary">
                    <div className="h-1.5 w-1.5 rounded-full bg-border" />
                    {formatSolvedDate(rev.date)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
