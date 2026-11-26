"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { Drawer } from "@/components/ui/drawer";
import {
  grammarCategories,
  mistakeStatuses,
  type GrammarCategory,
  type GrammarMistakeItem,
  type MistakeStatus,
} from "@/features/english-communication/english-types";

const ChartCard = dynamic(
  () => import("@/features/time-tracker/time-charts").then((mod) => mod.ChartCard),
  {
    ssr: false,
    loading: () => (
      <div className="h-[212px] animate-pulse bg-surface-raised rounded-lg border border-border" />
    ),
  },
);

type MistakesTabProps = {
  items: GrammarMistakeItem[];
  onSave: (nextItems: GrammarMistakeItem[]) => Promise<void>;
  initialAction?: string | null;
  onActionHandled?: () => void;
};

export function MistakesTab({
  items,
  onSave,
  initialAction,
  onActionHandled,
}: MistakesTabProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [originalSentence, setOriginalSentence] = useState("");
  const [correctedSentence, setCorrectedSentence] = useState("");
  const [naturalAlternative, setNaturalAlternative] = useState("");
  const [explanation, setExplanation] = useState("");
  const [grammarCategory, setGrammarCategory] = useState<GrammarCategory>("Tenses");
  const [example, setExample] = useState("");
  const [status, setStatus] = useState<MistakeStatus>("Needs revision");

  useEffect(() => {
    if (initialAction === "add") {
      openAddDrawer();
      onActionHandled?.();
    }
  }, [initialAction]);

  const categoryChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.grammarCategory, (counts.get(item.grammarCategory) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, hours]) => ({
      name,
      hours,
      value: hours,
    }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((m) => (categoryFilter === "all" ? true : m.grammarCategory === categoryFilter))
      .filter((m) => (statusFilter === "all" ? true : m.status === statusFilter))
      .filter((m) => {
        if (!q) return true;
        return (
          m.originalSentence.toLowerCase().includes(q) ||
          m.correctedSentence.toLowerCase().includes(q) ||
          m.naturalAlternative.toLowerCase().includes(q) ||
          m.explanation.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, query, categoryFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      needsRevision: items.filter((i) => i.status === "Needs revision").length,
      practicing: items.filter((i) => i.status === "Practicing").length,
      resolved: items.filter((i) => i.status === "Resolved").length,
    }),
    [items],
  );

  function openAddDrawer() {
    setEditingId(null);
    setOriginalSentence("");
    setCorrectedSentence("");
    setNaturalAlternative("");
    setExplanation("");
    setGrammarCategory("Tenses");
    setExample("");
    setStatus("Needs revision");
    setDrawerOpen(true);
  }

  function openEditDrawer(item: GrammarMistakeItem) {
    setEditingId(item.id);
    setOriginalSentence(item.originalSentence);
    setCorrectedSentence(item.correctedSentence);
    setNaturalAlternative(item.naturalAlternative);
    setExplanation(item.explanation);
    setGrammarCategory(item.grammarCategory);
    setExample(item.example);
    setStatus(item.status);
    setDrawerOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!originalSentence.trim() || !correctedSentence.trim()) {
      toast.error("Original and corrected sentences are required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingId ? items.find((i) => i.id === editingId) : null;
    const nextItem: GrammarMistakeItem = {
      id: editingId || crypto.randomUUID(),
      originalSentence: originalSentence.trim(),
      correctedSentence: correctedSentence.trim(),
      naturalAlternative: naturalAlternative.trim(),
      explanation: explanation.trim(),
      grammarCategory,
      example: example.trim(),
      status,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextList = editingId
      ? items.map((i) => (i.id === editingId ? nextItem : i))
      : [nextItem, ...items];

    await onSave(nextList);
    setDrawerOpen(false);
    toast.success(editingId ? "Mistake entry updated." : "Grammar mistake logged.");
  }

  async function handleCycleStatus(item: GrammarMistakeItem) {
    const idx = mistakeStatuses.indexOf(item.status);
    const nextStatus = mistakeStatuses[(idx + 1) % mistakeStatuses.length];
    await onSave(
      items.map((m) =>
        m.id === item.id ? { ...m, status: nextStatus, updatedAt: new Date().toISOString() } : m,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <div>
            <span className="text-text-tertiary">Needs Revision:</span>{" "}
            <strong className="text-destructive">{counts.needsRevision}</strong>
          </div>
          <span className="text-text-tertiary">·</span>
          <div>
            <span className="text-text-tertiary">Practicing:</span>{" "}
            <strong className="text-accent">{counts.practicing}</strong>
          </div>
          <span className="text-text-tertiary">·</span>
          <div>
            <span className="text-text-tertiary">Resolved:</span>{" "}
            <strong className="text-success">{counts.resolved}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddDrawer}
          className="h-9 px-4 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 flex items-center gap-1.5 w-fit"
        >
          <Plus className="h-4 w-4" /> Log Grammar Mistake
        </button>
      </div>

      {/* Category Distribution Chart */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card">
          <ChartCard
            title="Mistake Category Distribution"
            subtitle="Recurring grammar areas"
            data={categoryChartData}
            kind="bar"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sentences or explanations..."
            className="w-full h-9 bg-background border border-border rounded-md pl-8 pr-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Grammar Categories</option>
          {grammarCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Statuses</option>
          {mistakeStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {filteredItems.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-card hover:border-border-hover transition-colors flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-accent-subtle text-accent-text">
                    {item.grammarCategory}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCycleStatus(item)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border transition-colors ${
                      item.status === "Resolved"
                        ? "border-success/40 bg-success/10 text-success"
                        : item.status === "Practicing"
                          ? "border-accent/40 bg-accent-subtle text-accent-text"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                    title="Click to cycle status"
                  >
                    {item.status}
                  </button>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditDrawer(item)}
                    aria-label="Edit mistake"
                    className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this mistake log?")) {
                        void onSave(items.filter((m) => m.id !== item.id));
                        toast.success("Mistake deleted.");
                      }
                    }}
                    aria-label="Delete mistake"
                    className="p-1.5 rounded-md text-text-tertiary hover:text-destructive hover:bg-surface-raised"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-destructive mb-1">
                    Original
                  </div>
                  <p className="text-[13px] text-text-secondary line-through decoration-destructive/60">
                    {item.originalSentence}
                  </p>
                </div>

                <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-success mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Corrected
                  </div>
                  <p className="text-[13px] text-text-primary font-medium">
                    {item.correctedSentence}
                  </p>
                </div>

                <div className="rounded-lg border border-accent/20 bg-accent-subtle p-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-accent-text mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Natural Alternative
                  </div>
                  <p className="text-[13px] text-text-primary">
                    {item.naturalAlternative || "—"}
                  </p>
                </div>
              </div>

              {(item.explanation || item.example) && (
                <div className="text-[12px] text-text-secondary space-y-1 border-t border-border pt-2.5">
                  {item.explanation && <p>{item.explanation}</p>}
                  {item.example && (
                    <p className="italic text-text-tertiary">Example: &quot;{item.example}&quot;</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center flex flex-col items-center gap-2">
          <TriangleAlert className="h-8 w-8 text-text-tertiary opacity-60" />
          <p className="text-[13px] text-text-secondary">
            No grammar mistakes logged yet. Capture recurring errors to turn them into strengths.
          </p>
          <button
            type="button"
            onClick={openAddDrawer}
            className="mt-2 h-8 px-4 rounded-md bg-accent text-background text-[12px] font-semibold"
          >
            Log First Mistake
          </button>
        </div>
      )}

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Grammar Mistake" : "Log Grammar Mistake"}
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="h-9 px-4 rounded-md border border-border text-[13px] text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="mistake-form"
              className="h-9 px-4 rounded-md bg-accent text-background text-[13px] font-semibold"
            >
              {editingId ? "Save Changes" : "Save Mistake"}
            </button>
          </div>
        }
      >
        <form id="mistake-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Original Sentence *
            </label>
            <textarea
              rows={2}
              required
              value={originalSentence}
              onChange={(e) => setOriginalSentence(e.target.value)}
              placeholder='e.g. "I am working here since 2 years."'
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Corrected Sentence *
            </label>
            <textarea
              rows={2}
              required
              value={correctedSentence}
              onChange={(e) => setCorrectedSentence(e.target.value)}
              placeholder='e.g. "I have been working here for 2 years."'
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">
              Natural Alternative
            </label>
            <textarea
              rows={2}
              value={naturalAlternative}
              onChange={(e) => setNaturalAlternative(e.target.value)}
              placeholder='e.g. "I’ve been with the team for about two years now."'
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Category</label>
              <select
                value={grammarCategory}
                onChange={(e) => setGrammarCategory(e.target.value as GrammarCategory)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {grammarCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MistakeStatus)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {mistakeStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Explanation</label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Why was this wrong? Rule reminder..."
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Extra Example</label>
            <input
              type="text"
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Another correct sentence using the same rule..."
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>
        </form>
      </Drawer>
    </div>
  );
}
