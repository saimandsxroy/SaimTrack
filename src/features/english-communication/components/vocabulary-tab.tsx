"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit3,
  Layers,
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
import {
  calculateNextReview,
  isItemDue,
  sortRevisionQueue,
} from "@/features/english-communication/english-srs";
import {
  masteryLevels,
  partsOfSpeech,
  type MasteryLevel,
  type ReviewRating,
  type VocabularyItem,
} from "@/features/english-communication/english-types";

type VocabularyTabProps = {
  items: VocabularyItem[];
  onSave: (nextItems: VocabularyItem[]) => Promise<void>;
  initialAction?: string | null;
  onActionHandled?: () => void;
};

type VocabSort = "newest" | "alphabetical" | "due" | "mastery";

function parseCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function VocabularyTab({
  items,
  onSave,
  initialAction,
  onActionHandled,
}: VocabularyTabProps) {
  const [query, setQuery] = useState("");
  const [masteryFilter, setMasteryFilter] = useState<MasteryLevel | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<VocabSort>("newest");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inlineAddOpen, setInlineAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);

  // Form state
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [hindiMeaning, setHindiMeaning] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("noun");
  const [pronunciation, setPronunciation] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  const [personalExample, setPersonalExample] = useState("");
  const [synonymsInput, setSynonymsInput] = useState("");
  const [antonymsInput, setAntonymsInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [masteryLevel, setMasteryLevel] = useState<MasteryLevel>("New");
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (initialAction === "add") {
      openAddDrawer();
      onActionHandled?.();
    } else if (initialAction === "flashcards") {
      setFlashcardsOpen(true);
      onActionHandled?.();
    }
  }, [initialAction]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach((v) => v.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [items]);

  const nowMs = Date.now();
  const dueQueue = useMemo(() => sortRevisionQueue(items, nowMs), [items, nowMs]);
  const masteredCount = useMemo(
    () => items.filter((v) => v.masteryLevel === "Mastered").length,
    [items],
  );
  const recentlyAdded = useMemo(
    () =>
      [...items]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items
      .filter((v) => (masteryFilter === "all" ? true : v.masteryLevel === masteryFilter))
      .filter((v) => (tagFilter === "all" ? true : v.tags.includes(tagFilter)))
      .filter((v) => (favoritesOnly ? v.favorite : true))
      .filter((v) => (dueOnly ? isItemDue(v, nowMs) : true))
      .filter((v) => {
        if (!q) return true;
        return (
          v.word.toLowerCase().includes(q) ||
          v.meaning.toLowerCase().includes(q) ||
          (v.hindiMeaning || "").toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q))
        );
      });

    return list.sort((a, b) => {
      if (sortBy === "alphabetical") return a.word.localeCompare(b.word);
      if (sortBy === "due") {
        const aDue = isItemDue(a, nowMs) ? 0 : 1;
        const bDue = isItemDue(b, nowMs) ? 0 : 1;
        if (aDue !== bDue) return aDue - bDue;
      }
      if (sortBy === "mastery") {
        return masteryLevels.indexOf(a.masteryLevel) - masteryLevels.indexOf(b.masteryLevel);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, query, masteryFilter, tagFilter, favoritesOnly, dueOnly, sortBy, nowMs]);

  function resetForm() {
    setEditingId(null);
    setWord("");
    setMeaning("");
    setHindiMeaning("");
    setPartOfSpeech("noun");
    setPronunciation("");
    setExampleSentence("");
    setPersonalExample("");
    setSynonymsInput("");
    setAntonymsInput("");
    setTagsInput("");
    setMasteryLevel("New");
    setFavorite(false);
  }

  function openAddDrawer() {
    resetForm();
    setInlineAddOpen(true);
  }

  function openEditDrawer(item: VocabularyItem) {
    setInlineAddOpen(false);
    setEditingId(item.id);
    setWord(item.word);
    setMeaning(item.meaning);
    setHindiMeaning(item.hindiMeaning || "");
    setPartOfSpeech(item.partOfSpeech);
    setPronunciation(item.pronunciation);
    setExampleSentence(item.exampleSentence);
    setPersonalExample(item.personalExample);
    setSynonymsInput(item.synonyms.join(", "));
    setAntonymsInput(item.antonyms.join(", "));
    setTagsInput(item.tags.join(", "));
    setMasteryLevel(item.masteryLevel);
    setFavorite(item.favorite);
    setDrawerOpen(true);
  }

  async function handleSaveWord(e: React.FormEvent) {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      toast.error("Word and meaning are required.");
      return;
    }

    const nowIso = new Date().toISOString();
    const existing = editingId ? items.find((i) => i.id === editingId) : null;

    const nextItem: VocabularyItem = {
      id: editingId || crypto.randomUUID(),
      word: word.trim(),
      meaning: meaning.trim(),
      ...(hindiMeaning.trim() ? { hindiMeaning: hindiMeaning.trim() } : {}),
      partOfSpeech: partOfSpeech.trim() || "other",
      pronunciation: pronunciation.trim(),
      exampleSentence: exampleSentence.trim(),
      personalExample: personalExample.trim(),
      synonyms: parseCommaList(synonymsInput),
      antonyms: parseCommaList(antonymsInput),
      tags: parseCommaList(tagsInput),
      masteryLevel,
      favorite,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      lastReviewedAt: existing?.lastReviewedAt,
      nextReviewAt: existing?.nextReviewAt,
      reviewCount: existing?.reviewCount ?? 0,
    };

    const nextList = editingId
      ? items.map((i) => (i.id === editingId ? nextItem : i))
      : [nextItem, ...items];

    await onSave(nextList);
    setDrawerOpen(false);
    setInlineAddOpen(false);
    resetForm();
    toast.success(editingId ? "Word updated." : "Word added to Vocabulary Vault.");
  }

  async function handleToggleFavorite(id: string) {
    const nextList = items.map((item) =>
      item.id === id ? { ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() } : item,
    );
    await onSave(nextList);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this vocabulary word?")) return;
    await onSave(items.filter((i) => i.id !== id));
    toast.success("Word removed.");
  }

  async function handleFlashcardRate(id: string, rating: ReviewRating) {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const reviewUpdate = calculateNextReview(target.masteryLevel, target.reviewCount, rating);
    const nextList = items.map((item) =>
      item.id === id
        ? {
            ...item,
            ...reviewUpdate,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    await onSave(nextList);
  }

  const flashcardQueue: FlashcardData[] = useMemo(
    () =>
      dueQueue.map((v) => ({
        id: v.id,
        frontTitle: v.word,
        frontSubtitle: v.partOfSpeech,
        meaning: v.meaning,
        secondaryMeaning: v.hindiMeaning,
        exampleSentence: v.personalExample || v.exampleSentence,
        pronunciation: v.pronunciation,
        synonyms: v.synonyms,
        masteryLevel: v.masteryLevel,
        reviewCount: v.reviewCount,
      })),
    [dueQueue],
  );

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <div className="flex flex-col gap-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-4 text-[13px]">
          <div>
            <span className="text-text-tertiary">Total:</span>{" "}
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
            Flashcard Review ({dueQueue.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (inlineAddOpen) {
                setInlineAddOpen(false);
              } else {
                openAddDrawer();
              }
            }}
            className="h-9 px-4 rounded-md bg-accent text-background text-[12px] font-semibold hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> {inlineAddOpen ? "Close Form" : "Add Word"}
          </button>
        </div>
      </div>

      {/* Clean Inline Vocabulary Entry Form */}
      {inlineAddOpen && (
        <section className="rounded-xl border border-accent/30 bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-border">
            <div>
              <h2 className="text-[15px] font-medium text-text-primary">Add New Vocabulary Word</h2>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Build your personal spaced-repetition vault.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInlineAddOpen(false)}
              className="text-[12px] text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveWord} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-tertiary">Word *</label>
                <input
                  type="text"
                  required
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  placeholder="e.g. articulate"
                  className="w-full bg-transparent border-b border-border text-[17px] font-medium text-text-primary py-1.5 outline-none focus:border-accent transition-colors placeholder:text-text-tertiary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Part of Speech</label>
                <select
                  value={partOfSpeech}
                  onChange={(e) => setPartOfSpeech(e.target.value)}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                >
                  {partsOfSpeech.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Pronunciation</label>
                <input
                  type="text"
                  value={pronunciation}
                  onChange={(e) => setPronunciation(e.target.value)}
                  placeholder="aar-tik-yuh-lit"
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">English Meaning *</label>
                <input
                  type="text"
                  required
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="Clear, concise definition..."
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">
                  Hindi Meaning (Optional)
                </label>
                <input
                  type="text"
                  value={hindiMeaning}
                  onChange={(e) => setHindiMeaning(e.target.value)}
                  placeholder="स्पष्ट रूप से बोलना"
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Example Sentence</label>
                <input
                  type="text"
                  value={exampleSentence}
                  onChange={(e) => setExampleSentence(e.target.value)}
                  placeholder="Standard sentence using the word..."
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Personal Example</label>
                <input
                  type="text"
                  value={personalExample}
                  onChange={(e) => setPersonalExample(e.target.value)}
                  placeholder="Your own sentence from interview or work..."
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Synonyms</label>
                <input
                  type="text"
                  value={synonymsInput}
                  onChange={(e) => setSynonymsInput(e.target.value)}
                  placeholder="eloquent, clear"
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Antonyms</label>
                <input
                  type="text"
                  value={antonymsInput}
                  onChange={(e) => setAntonymsInput(e.target.value)}
                  placeholder="vague, unclear"
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Tags</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="interview, tech"
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Mastery Level</label>
                <select
                  value={masteryLevel}
                  onChange={(e) => setMasteryLevel(e.target.value as MasteryLevel)}
                  className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
                >
                  {masteryLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="h-4 w-4 accent-[#CBA365]"
                />
                Mark as favorite
              </label>
              <button
                type="submit"
                className="h-9 px-5 rounded-md bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity"
              >
                Save Word
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Recently Added Strip */}
      {recentlyAdded.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Recently Added
          </span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {recentlyAdded.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openEditDrawer(item)}
                className="text-left rounded-lg border border-border bg-surface p-3 hover:border-border-hover transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-text-primary truncate">
                    {item.word}
                  </span>
                  <span className="text-[10px] text-accent shrink-0">{item.masteryLevel}</span>
                </div>
                <p className="text-[11px] text-text-secondary truncate mt-1">{item.meaning}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search word, meaning, Hindi, or tag..."
            className="w-full h-9 bg-background border border-border rounded-md pl-8 pr-3 text-[12px] text-text-primary focus:outline-accent placeholder:text-text-tertiary"
          />
        </div>

        <select
          value={masteryFilter}
          onChange={(e) => setMasteryFilter(e.target.value as MasteryLevel | "all")}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Mastery</option>
          {masteryLevels.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>

        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="all">All Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as VocabSort)}
          className="h-9 bg-background border border-border rounded-md px-2.5 text-[12px] text-text-primary focus:outline-accent"
        >
          <option value="newest">Newest First</option>
          <option value="alphabetical">A &rarr; Z</option>
          <option value="due">Due for Review First</option>
          <option value="mastery">Mastery Level</option>
        </select>

        <button
          type="button"
          onClick={() => setFavoritesOnly((f) => !f)}
          className={`h-9 px-3 rounded-md border text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
            favoritesOnly
              ? "border-accent bg-accent-subtle text-accent-text"
              : "border-border bg-background text-text-secondary hover:text-text-primary"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${favoritesOnly ? "fill-accent text-accent" : ""}`} />
          Favorites
        </button>

        <button
          type="button"
          onClick={() => setDueOnly((d) => !d)}
          className={`h-9 px-3 rounded-md border text-[12px] font-medium transition-colors ${
            dueOnly
              ? "border-accent bg-accent-subtle text-accent-text"
              : "border-border bg-background text-text-secondary hover:text-text-primary"
          }`}
        >
          Due Queue
        </button>
      </div>

      {/* Vocabulary List */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const due = isItemDue(item, nowMs);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-surface p-5 shadow-card hover:border-border-hover transition-colors flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-semibold text-text-primary">{item.word}</h3>
                        <span className="text-[11px] text-text-tertiary italic">
                          {item.partOfSpeech}
                        </span>
                        {item.pronunciation && (
                          <span className="text-[11px] font-mono text-text-secondary">
                            /{item.pronunciation}/
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-text-primary mt-1">{item.meaning}</p>
                      {item.hindiMeaning && (
                        <p className="text-[12px] text-accent-text mt-0.5">{item.hindiMeaning}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {speechSupported && (
                        <button
                          type="button"
                          onClick={() => speakText(item.word)}
                          aria-label={`Pronounce ${item.word}`}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-raised transition-colors"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleToggleFavorite(item.id)}
                        aria-label="Toggle favorite"
                        className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-surface-raised transition-colors"
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${item.favorite ? "fill-accent text-accent" : ""}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDrawer(item)}
                        aria-label={`Edit ${item.word}`}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        aria-label={`Delete ${item.word}`}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-destructive hover:bg-surface-raised transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {(item.personalExample || item.exampleSentence) && (
                    <p className="mt-2.5 text-[12px] text-text-secondary italic border-l-2 border-border pl-2.5">
                      &quot;{item.personalExample || item.exampleSentence}&quot;
                    </p>
                  )}

                  {(item.synonyms.length > 0 || item.antonyms.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-tertiary">
                      {item.synonyms.length > 0 && (
                        <span>
                          Syn: <span className="text-text-secondary">{item.synonyms.join(", ")}</span>
                        </span>
                      )}
                      {item.antonyms.length > 0 && (
                        <span>
                          Ant: <span className="text-text-secondary">{item.antonyms.join(", ")}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded font-medium ${
                        item.masteryLevel === "Mastered"
                          ? "bg-success/15 text-success"
                          : "bg-accent-subtle text-accent-text"
                      }`}
                    >
                      {item.masteryLevel}
                    </span>
                    {due && (
                      <span className="px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary">
                        Due
                      </span>
                    )}
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-background border border-border text-text-tertiary"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-text-tertiary shrink-0">Reviews: {item.reviewCount}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center flex flex-col items-center gap-2">
          <BookOpen className="h-8 w-8 text-text-tertiary opacity-60" />
          <p className="text-[13px] text-text-secondary">No vocabulary words match your filters.</p>
          <button
            type="button"
            onClick={openAddDrawer}
            className="mt-2 h-8 px-4 rounded-md bg-accent text-background text-[12px] font-semibold"
          >
            Add First Word
          </button>
        </div>
      )}

      {/* Add/Edit Word Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Vocabulary Word" : "Add Vocabulary Word"}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="h-9 px-4 rounded-md border border-border text-[13px] text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="vocab-form"
              className="h-9 px-4 rounded-md bg-accent text-background text-[13px] font-semibold hover:opacity-90"
            >
              {editingId ? "Save Changes" : "Save Word"}
            </button>
          </div>
        }
      >
        <form id="vocab-form" onSubmit={handleSaveWord} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Word *</label>
              <input
                type="text"
                required
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="e.g. articulate"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Part of Speech</label>
              <select
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {partsOfSpeech.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Meaning *</label>
            <input
              type="text"
              required
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="Clear English definition..."
              className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">
                Hindi Meaning (Optional)
              </label>
              <input
                type="text"
                value={hindiMeaning}
                onChange={(e) => setHindiMeaning(e.target.value)}
                placeholder="स्पष्ट रूप से व्यक्त करना"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Pronunciation</label>
              <input
                type="text"
                value={pronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
                placeholder="aar-tik-yuh-layt"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Example Sentence</label>
            <textarea
              rows={2}
              value={exampleSentence}
              onChange={(e) => setExampleSentence(e.target.value)}
              placeholder="Standard usage example..."
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[12px] font-medium text-text-secondary">Personal Example</label>
            <textarea
              rows={2}
              value={personalExample}
              onChange={(e) => setPersonalExample(e.target.value)}
              placeholder="Your own sentence from work or interview prep..."
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-[13px] text-text-primary focus:outline-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">
                Synonyms (comma separated)
              </label>
              <input
                type="text"
                value={synonymsInput}
                onChange={(e) => setSynonymsInput(e.target.value)}
                placeholder="eloquent, clear"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">
                Antonyms (comma separated)
              </label>
              <input
                type="text"
                value={antonymsInput}
                onChange={(e) => setAntonymsInput(e.target.value)}
                placeholder="mumble, vague"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
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
                placeholder="interview, tech"
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-medium text-text-secondary">Mastery Level</label>
              <select
                value={masteryLevel}
                onChange={(e) => setMasteryLevel(e.target.value as MasteryLevel)}
                className="w-full h-9 bg-background border border-border rounded-md px-3 text-[13px] text-text-primary focus:outline-accent"
              >
                {masteryLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
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

      {/* Flashcard Revision Modal */}
      <FlashcardModal
        isOpen={flashcardsOpen}
        title="Vocabulary Flashcard Revision"
        queue={flashcardQueue}
        totalCount={items.length}
        masteredCount={masteredCount}
        onRate={(id, rating) => void handleFlashcardRate(id, rating)}
        onClose={() => setFlashcardsOpen(false)}
      />
    </div>
  );
}
