"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Search, CheckCircle2, AlertCircle, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { loadDsaProblems } from "@/features/dsa-tracker/dsa-tracker-storage";
import type { DsaProblem, DsaDifficulty, DsaPlatform, DsaTopic } from "@/features/dsa-tracker/dsa-tracker-types";
import { dsaDifficulties, dsaPlatforms, dsaTopics } from "@/features/dsa-tracker/dsa-tracker-types";
import { formatSolvedDate } from "@/features/dsa-tracker/dsa-tracker-utils";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } }
};

export default function DsaProblemsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [problems, setProblems] = useState<DsaProblem[]>([]);

  // Filters
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<DsaTopic | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DsaDifficulty | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<DsaPlatform | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "revision" | "mastered">("all");

  useEffect(() => {
    async function init() {
      if (!user) return;
      const stored = await loadDsaProblems(user.uid);
      setProblems(stored);
      setHydrated(true);
    }
    init();
  }, [user]);

  const filteredProblems = useMemo(() => {
    let result = [...problems];
    
    if (topicFilter !== "all") result = result.filter(p => p.topic === topicFilter);
    if (difficultyFilter !== "all") result = result.filter(p => p.difficulty === difficultyFilter);
    if (platformFilter !== "all") result = result.filter(p => p.platform === platformFilter);
    
    if (statusFilter === "revision") result = result.filter(p => p.revisionRequired);
    if (statusFilter === "mastered") result = result.filter(p => !p.revisionRequired);
    
    const q = query.toLowerCase().trim();
    if (q) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.topic.toLowerCase().includes(q)
      );
    }
    
    result.sort((a, b) => new Date(b.solvedDate).getTime() - new Date(a.solvedDate).getTime());
    return result;
  }, [problems, topicFilter, difficultyFilter, platformFilter, statusFilter, query]);

  // Analytics
  const easy = problems.filter(p => p.difficulty === "Easy").length;
  const med = problems.filter(p => p.difficulty === "Medium").length;
  const hard = problems.filter(p => p.difficulty === "Hard").length;

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
        <Link href="/dsa-tracker" className="inline-flex items-center gap-2 text-[13px] font-medium text-text-tertiary hover:text-text-primary transition-colors w-fit">
          <ChevronLeft className="h-4 w-4" /> Back to DSA Tracker
        </Link>
        <div>
          <h1 className="text-[28px] font-medium tracking-tight text-text-primary">Problem Log</h1>
          <p className="mt-1 text-[15px] text-text-secondary">A detailed archive of every algorithm and data structure you&apos;ve conquered.</p>
        </div>
      </motion.div>

      {/* Analytics Summary */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Solved", value: problems.length, color: "text-text-primary" },
          { label: "Easy", value: easy, color: "text-text-secondary" },
          { label: "Medium", value: med, color: "text-accent" },
          { label: "Hard", value: hard, color: "text-[#CBA365]" },
        ].map((stat, i) => (
          <motion.div key={i} variants={staggerItem} className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between">
            <span className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary mb-3">{stat.label}</span>
            <span className={`text-[24px] font-semibold tracking-tight ${stat.color}`}>{stat.value}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div className="relative w-full xl:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Search problems..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 bg-background border border-border rounded-md pl-9 pr-3 text-[13px] text-text-primary focus:outline-accent transition-all placeholder:text-text-tertiary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value as DsaTopic | "all")} className="h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent flex-1 sm:flex-none">
            <option value="all">All Topics</option>
            {dsaTopics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as DsaDifficulty | "all")} className="h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent flex-1 sm:flex-none">
            <option value="all">All Difficulties</option>
            {dsaDifficulties.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as DsaPlatform | "all")} className="h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent flex-1 sm:flex-none">
            <option value="all">All Platforms</option>
            {dsaPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "revision" | "mastered")} className="h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent flex-1 sm:flex-none">
            <option value="all">Any Status</option>
            <option value="mastered">Mastered</option>
            <option value="revision">Needs Revision</option>
          </select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-text-tertiary uppercase tracking-[0.04em] font-medium text-[11px]">
                <th className="px-5 py-3 w-[40px]"></th>
                <th className="px-5 py-3">Problem Name</th>
                <th className="px-5 py-3">Difficulty</th>
                <th className="px-5 py-3">Topic</th>
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3">Revisions</th>
                <th className="px-5 py-3 text-right">Date Solved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredProblems.map((p) => (
                <tr 
                  key={p.id} 
                  onClick={() => router.push(`/dsa-tracker/problem/${p.id}`)}
                  className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    {p.revisionRequired ? (
                      <div title="Needs Revision"><AlertCircle className="h-4 w-4 text-warning" /></div>
                    ) : (
                      <div title="Mastered"><CheckCircle2 className="h-4 w-4 text-text-tertiary group-hover:text-success transition-colors" /></div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-text-primary group-hover:text-accent transition-colors">
                    {p.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                      p.difficulty === 'Easy' ? 'bg-surface-raised text-text-secondary border-border' :
                      p.difficulty === 'Medium' ? 'bg-accent/10 text-accent border-accent/20' :
                      'bg-[#CBA365]/10 text-[#CBA365] border-[#CBA365]/20'
                    }`}>
                      {p.difficulty}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {p.topic}
                  </td>
                  <td className="px-5 py-3.5 text-text-tertiary">
                    {p.platform}
                  </td>
                  <td className="px-5 py-3.5 text-text-tertiary">
                    {p.revisions?.length || 0}
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary text-right">
                    {formatSolvedDate(p.solvedDate)}
                  </td>
                </tr>
              ))}
              {filteredProblems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-text-tertiary">
                    No problems found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
