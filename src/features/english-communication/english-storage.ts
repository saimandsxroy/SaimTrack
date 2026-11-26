import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_DAILY_ENGLISH_GOAL_MS,
  type EnglishCommunicationStateDoc,
  type EnglishMistakesDoc,
  type EnglishPhrasesDoc,
  type EnglishPracticeJournalDoc,
  type EnglishVocabularyDoc,
} from "@/features/english-communication/english-types";
import {
  englishMistakesDocSchema,
  englishPhrasesDocSchema,
  englishPracticeJournalDocSchema,
  englishStateDocSchema,
  englishVocabularyDocSchema,
} from "@/features/english-communication/english-schemas";
import { getDefaultTimezone, toZonedDateKey } from "@/features/english-communication/english-streak";

export const FIRESTORE_MAX_BYTES = 1_048_576; // 1 MiB
export const FIRESTORE_WARN_BYTES = 750_000; // ~71% threshold
export const FIRESTORE_BLOCK_BYTES = 960_000; // Hard safety guard before 1 MiB limit

export function measurePayloadBytes(payload: unknown): number {
  const serialized = JSON.stringify(payload);
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(serialized).length;
  }
  return serialized.length * 2;
}

export type DocumentSizeStatus = {
  docName: string;
  bytes: number;
  percentOfLimit: number;
  nearLimit: boolean;
  overLimit: boolean;
};

export function getDocumentSizeStatus(docName: string, payload: unknown): DocumentSizeStatus {
  const bytes = measurePayloadBytes(payload);
  const percentOfLimit = Math.min(100, Math.round((bytes / FIRESTORE_MAX_BYTES) * 100));
  return {
    docName,
    bytes,
    percentOfLimit,
    nearLimit: bytes >= FIRESTORE_WARN_BYTES,
    overLimit: bytes >= FIRESTORE_BLOCK_BYTES,
  };
}

export function createDefaultEnglishState(): EnglishCommunicationStateDoc {
  const timezone = getDefaultTimezone();
  const todayKey = toZonedDateKey(new Date(), timezone);
  return {
    dailyGoalMs: DEFAULT_DAILY_ENGLISH_GOAL_MS,
    timezone,
    goalHistory: [{ effectiveDate: todayKey, goalMs: DEFAULT_DAILY_ENGLISH_GOAL_MS }],
    plannedRestDays: [],
    celebratedGoalDates: [],
    challengeRecords: [],
    unlockedAchievements: [],
    animationsEnabled: true,
  };
}

export const defaultVocabularyDoc: EnglishVocabularyDoc = { items: [] };
export const defaultPhrasesDoc: EnglishPhrasesDoc = { items: [] };
export const defaultMistakesDoc: EnglishMistakesDoc = { items: [] };
export const defaultPracticeJournalDoc: EnglishPracticeJournalDoc = {
  journals: [],
  assessments: [],
};

type EnglishDocId = "state" | "vocabulary" | "phrases" | "mistakes" | "practice-journal";

function localKey(userId: string, docId: EnglishDocId) {
  return `careeros.english-communication.${docId}.${userId}`;
}

function saveLocal<T>(userId: string, docId: EnglishDocId, data: T) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(localKey(userId, docId), JSON.stringify(data));
  } catch {
    // non-critical
  }
}

function loadLocal<T>(userId: string, docId: EnglishDocId): T | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(localKey(userId, docId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadEnglishDoc<T>(
  userId: string,
  docId: EnglishDocId,
  fallback: T,
  validate: (data: unknown) => T | null,
): Promise<T> {
  if (db && userId) {
    try {
      const ref = doc(db, "users", userId, "english-communication", docId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const parsed = validate(snap.data());
        if (parsed) {
          saveLocal(userId, docId, parsed);
          return parsed;
        }
      }
    } catch (error) {
      console.error(`Failed to load english-communication/${docId}:`, error);
    }
  }

  const cached = loadLocal<T>(userId, docId);
  if (cached) {
    const parsed = validate(cached);
    if (parsed) return parsed;
  }
  return fallback;
}

async function saveEnglishDoc<T extends Record<string, unknown>>(
  userId: string,
  docId: EnglishDocId,
  payload: T,
  validate: (data: unknown) => T | null,
): Promise<{ savedRemote: boolean; nearLimit: boolean; bytes: number }> {
  const stamped = { ...payload, updatedAt: new Date().toISOString() };
  const validated = validate(stamped);
  if (!validated) {
    throw new Error(`Invalid payload for english-communication/${docId}`);
  }

  const size = getDocumentSizeStatus(docId, validated);
  if (size.overLimit) {
    throw new Error(
      `Document "${docId}" has reached ${size.percentOfLimit}% of Firestore's 1 MiB limit. Archive older entries before adding more.`,
    );
  }

  saveLocal(userId, docId, validated);

  if (!db || !userId) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }

  try {
    const ref = doc(db, "users", userId, "english-communication", docId);
    await setDoc(ref, validated, { merge: true });
    return { savedRemote: true, nearLimit: size.nearLimit, bytes: size.bytes };
  } catch (error) {
    console.error(`Failed to save english-communication/${docId}:`, error);
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }
}

export async function loadAllEnglishData(userId: string): Promise<{
  state: EnglishCommunicationStateDoc;
  vocabulary: EnglishVocabularyDoc;
  phrases: EnglishPhrasesDoc;
  mistakes: EnglishMistakesDoc;
  practiceJournal: EnglishPracticeJournalDoc;
}> {
  const defaultState = createDefaultEnglishState();

  const [state, vocabulary, phrases, mistakes, practiceJournal] = await Promise.all([
    loadEnglishDoc(userId, "state", defaultState, (d) => {
      const res = englishStateDocSchema.safeParse(d);
      return res.success ? res.data : null;
    }),
    loadEnglishDoc(userId, "vocabulary", defaultVocabularyDoc, (d) => {
      const res = englishVocabularyDocSchema.safeParse(d);
      return res.success ? res.data : null;
    }),
    loadEnglishDoc(userId, "phrases", defaultPhrasesDoc, (d) => {
      const res = englishPhrasesDocSchema.safeParse(d);
      return res.success ? res.data : null;
    }),
    loadEnglishDoc(userId, "mistakes", defaultMistakesDoc, (d) => {
      const res = englishMistakesDocSchema.safeParse(d);
      return res.success ? res.data : null;
    }),
    loadEnglishDoc(userId, "practice-journal", defaultPracticeJournalDoc, (d) => {
      const res = englishPracticeJournalDocSchema.safeParse(d);
      return res.success ? res.data : null;
    }),
  ]);

  return { state, vocabulary, phrases, mistakes, practiceJournal };
}

export async function saveEnglishState(userId: string, state: EnglishCommunicationStateDoc) {
  // Use Firestore transaction when online to safely merge celebratedGoalDates & unlockedAchievements
  const stamped = { ...state, updatedAt: new Date().toISOString() };
  const parsed = englishStateDocSchema.safeParse(stamped);
  if (!parsed.success) {
    throw new Error("Invalid English Communication state payload.");
  }

  saveLocal(userId, "state", parsed.data);
  const size = getDocumentSizeStatus("state", parsed.data);

  if (!db || !userId || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }

  try {
    const ref = doc(db, "users", userId, "english-communication", "state");
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, parsed.data);
        return;
      }
      const remote = snap.data() as Partial<EnglishCommunicationStateDoc>;
      const mergedCelebrated = Array.from(
        new Set([...(remote.celebratedGoalDates ?? []), ...parsed.data.celebratedGoalDates]),
      );
      const achievementMap = new Map<string, { id: string; unlockedAt: string }>();
      for (const a of [...(remote.unlockedAchievements ?? []), ...parsed.data.unlockedAchievements]) {
        if (!achievementMap.has(a.id)) achievementMap.set(a.id, a);
      }
      tx.set(
        ref,
        {
          ...parsed.data,
          celebratedGoalDates: mergedCelebrated,
          unlockedAchievements: Array.from(achievementMap.values()),
        },
        { merge: true },
      );
    });
    return { savedRemote: true, nearLimit: size.nearLimit, bytes: size.bytes };
  } catch (error) {
    console.error("Failed to save english-communication/state transactionally:", error);
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }
}

export function saveEnglishVocabulary(userId: string, payload: EnglishVocabularyDoc) {
  return saveEnglishDoc(userId, "vocabulary", payload, (d) => {
    const res = englishVocabularyDocSchema.safeParse(d);
    return res.success ? res.data : null;
  });
}

export function saveEnglishPhrases(userId: string, payload: EnglishPhrasesDoc) {
  return saveEnglishDoc(userId, "phrases", payload, (d) => {
    const res = englishPhrasesDocSchema.safeParse(d);
    return res.success ? res.data : null;
  });
}

export function saveEnglishMistakes(userId: string, payload: EnglishMistakesDoc) {
  return saveEnglishDoc(userId, "mistakes", payload, (d) => {
    const res = englishMistakesDocSchema.safeParse(d);
    return res.success ? res.data : null;
  });
}

export function saveEnglishPracticeJournal(userId: string, payload: EnglishPracticeJournalDoc) {
  return saveEnglishDoc(userId, "practice-journal", payload, (d) => {
    const res = englishPracticeJournalDocSchema.safeParse(d);
    return res.success ? res.data : null;
  });
}
