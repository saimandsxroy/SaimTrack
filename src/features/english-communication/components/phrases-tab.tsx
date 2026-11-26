"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Layers,
  MessageSquareQuote,
  Plus,
  Search,
  Star,
  Trash2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { Drawer } from "@/components/ui/drawer";
import {
  FlashcardModal,
  speakText,
  type FlashcardData,
} from "@/features/english-communication/components/flashcard-modal";
import { calculateNextReview, sortRevisionQueue } from "@/features/english-communication/english-srs";
import {
  masteryLevels,
  phraseCategories,
  phraseFormalities,
  type MasteryLevel,
  type PhraseFormality,
  type PhraseItem,
  type ReviewRating,
} from "@/features/english-communication/english-types";

type PhrasesTabProps = {
  items: PhraseItem[];
  onSave: (nextItems: PhraseItem[]) => Promise<void>;
  initialAction?: string | null;
  onActionHandled?: () => void;
};

export function PhrasesTab({
  items,
  onSave,
  initialAction,
  onActionHandled,
}: PhrasesTabProps) {
  const [query, setQuery] = useState("");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [formalityFilter, setFormalityFilter] = useState<string>("all");
  const [masteryFilter, setMasteryFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);

  const [phrase, setPhrase] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [context, setContext] = useState<string>(phraseCategories[0]);
  const [formality, setFormality] = useState<PhraseFormality>("Professional");
  const [tagsInput, setTagsInput] = useState("");
  const [masteryLevel, setMasteryLevel] = useState<MasteryLevel>("New");
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (initialAction === "add") {
      openAddDrawer();
      onActionHandled?.();
    }
  }, [initialAction]);

  const nowMs = Date.now();
  const dueQueue = useMemo(
    () =>
      sortRevisionQueue(
        items.map((p) => ({ ...p, reviewCount: p.reviewCount ?? 0 })),
        nowMs,
      ),
    [items, nowMs],
  );
  const masteredCount = useMemo(
    () => items.filter((p) => p.masteryLevel === "Mastered").length,
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((p) => (contextFilter === "all" ? true : p.context === contextFilter))
      .filter((p) => (formalityFilter === "all" ? true : p.formality === formalityFilter))
      .filter((p) => (masteryFilter === "all" ? true : p.masteryLevel === masteryFilter))
      .filter((p) => (favoritesOnly ? p.favorite : true))
      .filter((p) => {
        if (!q) return true;
        return (
          p.phrase.toLowerCase().includes(q) ||
          p.meaning.toLowerCase().includes(q) ||
          p.example.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, query, contextFilter, formalityFilter, masteryFilter, favoritesOnly]);

  function openAddDrawer() {
    setEditingId(null);
    setPhrase("");
    setMeaning("");
    setExample("");
    setContext(phraseCategories[0]);
    setFormality("Professional");
    setTagsInput("");
    setMasteryLevel("New");
    setFavorite(false);
    setDrawerOpen(true);
  }

  function openEditDrawer(item: PhraseItem) {
    setEditingId(item.id);
    setPhrase(item.phrase);
    setMeaning(item.meaning);
    setExample(item.example);
    setContext(item.context);
    setFormality(item.formality);
    setTagsInput(item.tags.join(", "));
    setMasteryLevel(item.masteryLevel);
    setFavorite(item.favorite);
    setDrawerOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!phrase.trim() || !meaning.trim()) {
      toast.error("Phrase and meaning are required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingId ? items.find((i) => i.id === editingId) : null;
    const nextItem: PhraseItem = {
      id: editingId || crypto.randomUUID(),
      phrase: phrase.trim(),
      meaning: meaning.trim(),
      example: example.trim(),
      context,
      formality,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      favorite,
      masteryLevel,
      reviewCount: existing?.reviewCount ?? 0,
      lastReviewedAt: existing?.lastReviewedAt,
      nextReviewAt: existing?.nextReviewAt,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextList = editingId
      ? items.map((i) => (i.id === editingId ? nextItem : i))
      : [nextItem, ...items];

    await onSave(nextList);
    setDrawerOpen(false);
    toast.success(editingId ? "Phrase updated." : "Phrase saved to library.");
  }

  async function handleRate(id: string, rating: ReviewRating) {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const reviewUpdate = calculateNextReview(
      target.masteryLevel,
      target.reviewCount ?? 0,
      rating,
    );
    await onSave(
      items.map((i) =>
        i.id === id ? { ...i, ...reviewUpdate, updatedAt: new Date().toISOString() } : i,
      ),
    );
  }

  const flashcardQueue: FlashcardData[] = useMemo(
    () =>
      dueQueue.map((p) => ({
        id: p.id,
        frontTitle: p.phrase,
        frontSubtitle: `${p.context} · ${p.formality}`,
        meaning: p.meaning,
        exampleSentence: p.example,
        masteryLevel: p.masteryLevel,
        reviewCount: p.reviewCount ?? 0,
      })),
    [dueQueue],
  );

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <div>
            <span className="text-text-tertiary">Total Phrases:</span>{" "}
            <strong className="text-text-primary">{items.length}</strong>
          </div>
          <span className="text-text-tertiary">·</span>
          <div>
            <span className="text-text-tertiary">Due Revision:</span>{" "}
            <strong className="text-accent">{dueQueue.length}</strong>
          </div>
          <span className="text-text-tertiary">·</span>
          <div>
            <span className="text-text-tertiary">Mastered:</span>{" "}
            <strong className="text-success">{masteredCount}</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setFlashcardsOpen(true)}
            className="h-9 px-4 rounded-md border border-border bg-surface-raised text-[12px] font-medium text-text-primary hover:border-border-hover flex items-center gap-2"
          >
            <Layers className="h-3.5 w-3.5 text-accent" />
            Flashcards ({dueQueue.length})
          </button>
          <button
            type="button"
            onClick={openAddDrawer}
            className="h-9 px-4 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Phrase
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search phrases, idioms, or examples..."
            className="w-full h-9 bg-background border border-border rounded-md pl-8 pr-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
          />
        </div>

        <select
          value={contextFilter}
          onChange={(e) => setContextFilter(e.target.value)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Contexts</option>
          {phraseCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={formalityFilter}
          onChange={(e) => setFormalityFilter(e.target.value)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Formality</option>
          {phraseFormalities.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          value={masteryFilter}
          onChange={(e) => setMasteryFilter(e.target.value)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Mastery</option>
          {masteryLevels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setFavoritesOnly((f) => !f)}
          className={`h-9 px-3 rounded-md border text-[12px] font-medium flex items-center gap-1.5 ${
            favoritesOnly
              ? "border-accent bg-accent-subtle text-accent-text"
              : "border-border bg-background text-text-secondary hover:text-text-primary"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${favoritesOnly ? "fill-accent text-accent" : ""}`} />
          Favorites
        </button>
      </div>

      {/* Cards */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-card hover:border-border-hover transition-colors flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-text-primary">&quot;{item.phrase}&quot;</h3>
                    <p className="text-[13px] text-text-secondary mt-1">{item.meaning}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={() => speakText(item.phrase)}
                        aria-label="Speak phrase"
                        className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-raised"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void onSave(
                          items.map((p) =>
                            p.id === item.id ? { ...p, favorite: !p.favorite } : p,
                          ),
                        )
                      }
                      aria-label="Toggle favorite"
                      className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-raised"
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${item.favorite ? "fill-accent text-accent" : ""}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditDrawer(item)}
                      aria-label="Edit phrase"
                      className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this phrase?")) {
                          void onSave(items.filter((p) => p.id !== item.id));
                          toast.success("Phrase removed.");
                        }
                      }}
                      aria-label="Delete phrase"
                      className="p-1.5 rounded-md text-text-tertiary hover:text-destructive hover:bg-surface-raised"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {item.example && (
                  <p className="mt-2.5 text-[12px] text-text-secondary italic border-l-2 border-border pl-2.5">
                    {item.example}
                  </p>
                )}
              </div>

              <div className="pt-2.5 border-t border-border flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-accent-subtle text-accent-text font-medium">
                  {item.context}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary">
                  {item.formality}
                </span>
                <span className="px-2 py-0.5 rounded bg-background border border-border text-text-secondary">
                  {item.masteryLevel}
                </span>
                {item.tags.map((tag) => (
                  <span key={tag} className="text-text-tertiary">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center flex flex-col items-center gap-2">
          <MessageSquareQuote className="h-8 w-8 text-text-tertiary opacity-60" />
          <p className="text-[13px] text-text-secondary">No phrases found in your library.</p>
          <button
            type="button"
            onClick={openAddDrawer}
            className="mt-2 h-8 px-4 rounded-md bg-accent text-background text-[12px] font-semibold"
          >
            Add First Phrase
          </button>
        </div>
      )}

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Phrase" : "Add Phrase or Expression"}
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
              form="phrase-form"
              className="h-9 px-4 rounded-md bg-accent text-background text-[13px] font-semibold"
            >
              {editingId ? "Save Changes" : "Save Phrase"}
            </button>
          </div>
        }
      >
        <form id="phrase-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Phrase / Idiom *</label>
            <input
              type="text"
              required
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder='e.g. "Let me walk you through my thought process"'
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Meaning *</label>
            <textarea
              rows={2}
              required
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="When and why to use this expression..."
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Example Sentence</label>
            <textarea
              rows={2}
              value={example}
              onChange={(e) => setExample(e.target.value)}
              placeholder="Real conversational usage..."
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Context Category</label>
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {phraseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Formality</label>
              <select
                value={formality}
                onChange={(e) => setFormality(e.target.value as PhraseFormality)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {phraseFormalities.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="opener, interview"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Mastery</label>
              <select
                value={masteryLevel}
                onChange={(e) => setMasteryLevel(e.target.value as MasteryLevel)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {masteryLevels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(e) => setFavorite(e.target.checked)}
              className="h-4 w-4 accent-[#CBA365]"
            />
            Mark as favorite
          </label>
        </form>
      </Drawer>

      <FlashcardModal
        isOpen={flashcardsOpen}
        title="Phrase & Expression Flashcards"
        queue={flashcardQueue}
        totalCount={items.length}
        masteredCount={masteredCount}
        onRate={(id, rating) => void handleRate(id, rating)}
        onClose={() => setFlashcardsOpen(false)}
      />
    </div>
  );
}
