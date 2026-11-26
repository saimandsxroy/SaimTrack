import type { MasteryLevel, ReviewRating } from "@/features/english-communication/english-types";

export interface ReviewableItem {
  id: string;
  masteryLevel: MasteryLevel;
  reviewCount?: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  createdAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function calculateNextReview(
  currentMastery: MasteryLevel,
  currentReviewCount: number,
  rating: ReviewRating,
  nowMs = Date.now(),
): {
  masteryLevel: MasteryLevel;
  reviewCount: number;
  lastReviewedAt: string;
  nextReviewAt: string;
} {
  const nextCount = currentReviewCount + 1;
  const lastReviewedAt = new Date(nowMs).toISOString();

  let masteryLevel: MasteryLevel = currentMastery;
  let intervalMs = DAY_MS;

  switch (rating) {
    case "Again":
      masteryLevel = "New";
      intervalMs = 10 * MINUTE_MS; // Re-queue shortly
      break;
    case "Hard":
      masteryLevel = "Learning";
      intervalMs = 1 * DAY_MS;
      break;
    case "Good":
      if (currentMastery === "New") {
        masteryLevel = "Learning";
        intervalMs = 2 * DAY_MS;
      } else if (currentMastery === "Learning") {
        masteryLevel = "Familiar";
        intervalMs = 4 * DAY_MS;
      } else {
        masteryLevel = "Mastered";
        intervalMs = Math.min(30, 5 + nextCount * 2) * DAY_MS;
      }
      break;
    case "Easy":
      if (currentMastery === "New" || currentMastery === "Learning") {
        masteryLevel = "Familiar";
        intervalMs = 5 * DAY_MS;
      } else {
        masteryLevel = "Mastered";
        intervalMs = Math.min(45, 10 + nextCount * 3) * DAY_MS;
      }
      break;
  }

  return {
    masteryLevel,
    reviewCount: nextCount,
    lastReviewedAt,
    nextReviewAt: new Date(nowMs + intervalMs).toISOString(),
  };
}

export function isItemDue(item: ReviewableItem, nowMs = Date.now()): boolean {
  if (item.masteryLevel === "Mastered" && !item.nextReviewAt) {
    return false;
  }
  if (!item.nextReviewAt) {
    return true;
  }
  const nextMs = new Date(item.nextReviewAt).getTime();
  if (Number.isNaN(nextMs)) return true;
  return nextMs <= nowMs;
}

export function sortRevisionQueue<T extends ReviewableItem>(items: T[], nowMs = Date.now()): T[] {
  return [...items]
    .filter((item) => isItemDue(item, nowMs))
    .sort((a, b) => {
      const aDue = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0;
      const bDue = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}
