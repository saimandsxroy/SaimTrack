"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, RotateCw, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MasteryLevel, ReviewRating } from "@/features/english-communication/english-types";

export type FlashcardData = {
  id: string;
  frontTitle: string;
  frontSubtitle?: string;
  meaning: string;
  secondaryMeaning?: string;
  exampleSentence?: string;
  pronunciation?: string;
  synonyms?: string[];
  masteryLevel: MasteryLevel;
  reviewCount: number;
};

type FlashcardModalProps = {
  isOpen: boolean;
  title: string;
  queue: FlashcardData[];
  totalCount: number;
  masteredCount: number;
  onRate: (id: string, rating: ReviewRating) => void;
  onClose: () => void;
};

export function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore unsupported environments
  }
}

export function FlashcardModal({
  isOpen,
  title,
  queue,
  totalCount,
  masteredCount,
  onRate,
  onClose,
}: FlashcardModalProps) {
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionIds, setSessionIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFlipped(false);
      setReviewedCount(0);
      setSessionIds(queue.map((item) => item.id));
    }
  }, [isOpen]);

  // Keep current card anchored to initial queue order + any "Again" re-queued items
  const currentCard =
    sessionIds.length > 0 ? queue.find((item) => item.id === sessionIds[0]) ?? queue[0] : queue[0];

  const handleReview = useCallback(
    (rating: ReviewRating) => {
      if (!currentCard) return;
      onRate(currentCard.id, rating);
      setFlipped(false);
      setReviewedCount((c) => c + 1);
      setSessionIds((prev) => {
        const rest = prev.filter((id) => id !== currentCard.id);
        return rating === "Again" ? [...rest, currentCard.id] : rest;
      });
    },
    [currentCard, onRate],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " || e.key === "Enter") {
        if (currentCard) {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      } else if (flipped && currentCard) {
        if (e.key === "1") handleReview("Again");
        if (e.key === "2") handleReview("Hard");
        if (e.key === "3") handleReview("Good");
        if (e.key === "4") handleReview("Easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, flipped, currentCard, handleReview, onClose]);

  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl z-50 rounded-2xl border border-border bg-surface shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-raised">
              <div>
                <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
                <div className="flex items-center gap-3 text-[11px] text-text-secondary mt-0.5">
                  <span>Due: {queue.length}</span>
                  <span>·</span>
                  <span>Reviewed: {reviewedCount}</span>
                  <span>·</span>
                  <span>
                    Mastered: {masteredCount}/{totalCount}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close flashcards"
                className="rounded-md p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center min-h-[340px]">
              {currentCard ? (
                <div className="flex flex-col gap-6">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setFlipped((f) => !f)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFlipped((f) => !f);
                      }
                    }}
                    className="min-h-[220px] rounded-xl border border-border bg-background p-6 sm:p-8 flex flex-col justify-center items-center text-center cursor-pointer hover:border-border-hover transition-colors"
                  >
                    {!flipped ? (
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-[10px] font-medium uppercase tracking-widest text-accent px-2 py-0.5 rounded bg-accent-subtle">
                          {currentCard.frontSubtitle || currentCard.masteryLevel}
                        </span>
                        <h3 className="text-[28px] sm:text-[34px] font-semibold text-text-primary tracking-tight">
                          {currentCard.frontTitle}
                        </h3>
                        {speechSupported && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(currentCard.frontTitle);
                            }}
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-surface text-[12px] text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <Volume2 className="h-3.5 w-3.5 text-accent" /> Pronounce
                          </button>
                        )}
                        <p className="mt-4 text-[11px] text-text-tertiary flex items-center gap-1.5">
                          <RotateCw className="h-3 w-3" /> Click or press Space to reveal meaning
                        </p>
                      </div>
                    ) : (
                      <div className="w-full text-left flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                          <div>
                            <h4 className="text-[20px] font-semibold text-text-primary">
                              {currentCard.frontTitle}
                            </h4>
                            {currentCard.pronunciation && (
                              <span className="text-[12px] font-mono text-text-secondary">
                                /{currentCard.pronunciation}/
                              </span>
                            )}
                          </div>
                          {speechSupported && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakText(currentCard.frontTitle);
                              }}
                              aria-label="Play pronunciation"
                              className="p-2 rounded-md border border-border bg-surface text-accent hover:border-border-hover"
                            >
                              <Volume2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div>
                          <div className="text-[11px] uppercase tracking-wider text-text-tertiary">
                            Meaning
                          </div>
                          <p className="text-[15px] text-text-primary mt-0.5">
                            {currentCard.meaning}
                          </p>
                          {currentCard.secondaryMeaning && (
                            <p className="text-[13px] text-accent-text mt-1">
                              {currentCard.secondaryMeaning}
                            </p>
                          )}
                        </div>

                        {currentCard.exampleSentence && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-text-tertiary">
                              Example
                            </div>
                            <p className="text-[13px] text-text-secondary italic mt-0.5">
                              &quot;{currentCard.exampleSentence}&quot;
                            </p>
                          </div>
                        )}

                        {currentCard.synonyms && currentCard.synonyms.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[11px] text-text-tertiary mr-1">Synonyms:</span>
                            {currentCard.synonyms.map((syn) => (
                              <span
                                key={syn}
                                className="text-[11px] px-2 py-0.5 rounded bg-surface-raised border border-border text-text-secondary"
                              >
                                {syn}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Review Controls */}
                  {flipped ? (
                    <div className="grid grid-cols-4 gap-2.5">
                      {(
                        [
                          { rating: "Again", hint: "10m · 1", cls: "border-destructive/40 text-destructive hover:bg-destructive/10" },
                          { rating: "Hard", hint: "1d · 2", cls: "border-warning/40 text-warning hover:bg-warning/10" },
                          { rating: "Good", hint: "2-4d · 3", cls: "border-accent/40 text-accent hover:bg-accent-subtle" },
                          { rating: "Easy", hint: "5d+ · 4", cls: "border-success/40 text-success hover:bg-success/10" },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.rating}
                          type="button"
                          onClick={() => handleReview(btn.rating)}
                          className={`h-12 rounded-lg border bg-background flex flex-col items-center justify-center transition-colors ${btn.cls}`}
                        >
                          <span className="text-[13px] font-semibold">{btn.rating}</span>
                          <span className="text-[10px] opacity-75">{btn.hint}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFlipped(true)}
                      className="h-11 rounded-lg bg-accent text-background text-[13px] font-semibold hover:opacity-90 transition-opacity"
                    >
                      Show Answer
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
                  <div className="h-12 w-12 rounded-full bg-accent-subtle border border-accent/30 flex items-center justify-center text-accent">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-[18px] font-semibold text-text-primary">
                    Revision Queue Complete
                  </h3>
                  <p className="text-[13px] text-text-secondary max-w-md">
                    {reviewedCount > 0
                      ? `Nice work! You reviewed ${reviewedCount} card${reviewedCount === 1 ? "" : "s"} in this session. Take a pause or practice speaking them in sentences.`
                      : "All cards are scheduled for future review. Add new items or check back tomorrow."}
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 h-9 px-5 rounded-md bg-accent text-background text-[13px] font-semibold hover:opacity-90"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
