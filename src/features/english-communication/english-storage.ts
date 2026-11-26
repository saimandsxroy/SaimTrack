import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { measurePayloadBytes, stripUndefined } from "@/lib/firestore-utils";
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

export { measurePayloadBytes, stripUndefined };

export const FIRESTORE_MAX_BYTES = 1_048_576; // 1 MiB
export const FIRESTORE_WARN_BYTES = 750_000; // ~71% threshold
export const FIRESTORE_BLOCK_BYTES = 960_000; // Hard safety guard before 1 MiB limit

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

export type EnglishDocId = "state" | "vocabulary" | "phrases" | "mistakes" | "practice-journal";

function localKey(userId: string, docId: EnglishDocId) {
  return `careeros.english-communication.${docId}.${userId}`;
}

function dirtyKey(userId: string) {
  return `careeros.english-communication.dirty.${userId}`;
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

export function loadDirtyEnglishDocs(userId: string): EnglishDocId[] {
  try {
    if (typeof window === "undefined" || !userId) return [];
    const raw = localStorage.getItem(dirtyKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EnglishDocId[]) : [];
  } catch {
    return [];
  }
}

function setDirtyEnglishDocs(userId: string, docs: EnglishDocId[]) {
  try {
    if (typeof window === "undefined" || !userId) return;
    if (docs.length === 0) {
      localStorage.removeItem(dirtyKey(userId));
    } else {
      localStorage.setItem(dirtyKey(userId), JSON.stringify(Array.from(new Set(docs))));
    }
  } catch {
    // non-critical
  }
}

function markEnglishDocDirty(userId: string, docId: EnglishDocId) {
  const existing = loadDirtyEnglishDocs(userId);
  if (!existing.includes(docId)) {
    setDirtyEnglishDocs(userId, [...existing, docId]);
  }
}

function clearEnglishDocDirty(userId: string, docId: EnglishDocId) {
  const existing = loadDirtyEnglishDocs(userId);
  if (existing.includes(docId)) {
    setDirtyEnglishDocs(
      userId,
      existing.filter((d) => d !== docId),
    );
  }
}

export function getPendingEnglishDocsCount(userId: string): number {
  return loadDirtyEnglishDocs(userId).length;
}

async function loadEnglishDoc<T>(
  userId: string,
  docId: EnglishDocId,
  fallback: T,
  validate: (data: unknown) => T | null,
): Promise<{ data: T; existsRemote: boolean; hadError: boolean }> {
  // If local storage holds unsynced offline edits for this document, preserve them
  // instead of overwriting them with stale remote data before reconciliation runs.
  const isDirty = loadDirtyEnglishDocs(userId).includes(docId);
  const cached = loadLocal<T>(userId, docId);
  if (isDirty && cached) {
    const parsedLocal = validate(cached);
    if (parsedLocal) {
      return { data: parsedLocal, existsRemote: false, hadError: false };
    }
  }

  let hadError = false;
  if (db && userId) {
    try {
      const ref = doc(db, "users", userId, "english-communication", docId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const parsed = validate(snap.data());
        if (parsed) {
          saveLocal(userId, docId, parsed);
          return { data: parsed, existsRemote: true, hadError: false };
        }
        // Document exists remotely but failed validation — avoid marking as missing remote.
        hadError = true;
      }
    } catch (error) {
      hadError = true;
      console.error(`Failed to load english-communication/${docId}:`, error);
    }
  }

  if (cached) {
    const parsed = validate(cached);
    if (parsed) return { data: parsed, existsRemote: false, hadError };
  }
  return { data: fallback, existsRemote: false, hadError };
}

async function saveEnglishDoc<T extends Record<string, unknown>>(
  userId: string,
  docId: EnglishDocId,
  payload: T,
  validate: (data: unknown) => T | null,
): Promise<{ savedRemote: boolean; nearLimit: boolean; bytes: number; error?: string }> {
  const stamped = { ...payload, updatedAt: new Date().toISOString() };
  const validated = validate(stamped);
  if (!validated) {
    throw new Error(`Invalid payload for english-communication/${docId}`);
  }
  const cleanPayload = stripUndefined(validated);

  const size = getDocumentSizeStatus(docId, cleanPayload);
  if (size.overLimit) {
    throw new Error(
      `Document "${docId}" has reached ${size.percentOfLimit}% of Firestore's 1 MiB limit. Archive older entries before adding more.`,
    );
  }

  saveLocal(userId, docId, cleanPayload);
  markEnglishDocDirty(userId, docId);

  if (!db || !userId) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes, error: "Firestore not initialized." };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }

  try {
    const ref = doc(db, "users", userId, "english-communication", docId);
    await setDoc(ref, cleanPayload, { merge: true });
    clearEnglishDocDirty(userId, docId);
    return { savedRemote: true, nearLimit: size.nearLimit, bytes: size.bytes };
  } catch (error) {
    console.error(`Failed to save english-communication/${docId}:`, error);
    return {
      savedRemote: false,
      nearLimit: size.nearLimit,
      bytes: size.bytes,
      error: error instanceof Error ? error.message : "Firestore write failed.",
    };
  }
}

export async function loadAllEnglishData(userId: string): Promise<{
  state: EnglishCommunicationStateDoc;
  stateExistsRemote: boolean;
  stateLoadError: boolean;
  vocabulary: EnglishVocabularyDoc;
  phrases: EnglishPhrasesDoc;
  mistakes: EnglishMistakesDoc;
  practiceJournal: EnglishPracticeJournalDoc;
}> {
  const defaultState = createDefaultEnglishState();

  const [stateRes, vocabularyRes, phrasesRes, mistakesRes, practiceJournalRes] = await Promise.all([
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

  return {
    state: stateRes.data,
    stateExistsRemote: stateRes.existsRemote,
    stateLoadError: stateRes.hadError,
    vocabulary: vocabularyRes.data,
    phrases: phrasesRes.data,
    mistakes: mistakesRes.data,
    practiceJournal: practiceJournalRes.data,
  };
}

export async function saveEnglishState(
  userId: string,
  state: EnglishCommunicationStateDoc,
  options?: { seedOnlyIfMissing?: boolean },
): Promise<{
  savedRemote: boolean;
  nearLimit: boolean;
  bytes: number;
  error?: string;
  adoptedRemoteState?: EnglishCommunicationStateDoc;
}> {
  const stamped = { ...state, updatedAt: new Date().toISOString() };
  const parsed = englishStateDocSchema.safeParse(stamped);
  if (!parsed.success) {
    throw new Error("Invalid English Communication state payload.");
  }
  const cleanData = stripUndefined(parsed.data);

  const size = getDocumentSizeStatus("state", cleanData);
  if (size.overLimit) {
    throw new Error(
      `Document "state" has reached ${size.percentOfLimit}% of Firestore's 1 MiB limit.`,
    );
  }

  saveLocal(userId, "state", cleanData);
  markEnglishDocDirty(userId, "state");

  if (!db || !userId) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes, error: "Firestore not initialized." };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { savedRemote: false, nearLimit: size.nearLimit, bytes: size.bytes };
  }

  try {
    const ref = doc(db, "users", userId, "english-communication", "state");
    let adoptedRemoteState: EnglishCommunicationStateDoc | undefined;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, cleanData);
        return;
      }

      const rawRemote = snap.data() as Partial<EnglishCommunicationStateDoc>;
      if (options?.seedOnlyIfMissing) {
        const parsedRemote = englishStateDocSchema.safeParse(rawRemote);
        if (parsedRemote.success) {
          adoptedRemoteState = stripUndefined(parsedRemote.data);
          return;
        }
      }

      const mergedCelebrated = Array.from(
        new Set([...(rawRemote.celebratedGoalDates ?? []), ...cleanData.celebratedGoalDates]),
      );
      const achievementMap = new Map<string, { id: string; unlockedAt: string }>();
      for (const a of [...(rawRemote.unlockedAchievements ?? []), ...cleanData.unlockedAchievements]) {
        if (!achievementMap.has(a.id)) achievementMap.set(a.id, a);
      }
      tx.set(
        ref,
        stripUndefined({
          ...cleanData,
          celebratedGoalDates: mergedCelebrated,
          unlockedAchievements: Array.from(achievementMap.values()),
        }),
        { merge: true },
      );
    });

    if (adoptedRemoteState) {
      saveLocal(userId, "state", adoptedRemoteState);
    }
    clearEnglishDocDirty(userId, "state");
    return {
      savedRemote: true,
      nearLimit: size.nearLimit,
      bytes: size.bytes,
      adoptedRemoteState,
    };
  } catch (error) {
    console.error("Failed to save english-communication/state transactionally:", error);
    return {
      savedRemote: false,
      nearLimit: size.nearLimit,
      bytes: size.bytes,
      error: error instanceof Error ? error.message : "Firestore write failed.",
    };
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

/**
 * Flushes any offline or previously failed English Communication document writes from localStorage
 * back to Cloud Firestore once connectivity is restored or user clicks Retry Sync.
 */
export async function reconcilePendingEnglishDocs(userId: string): Promise<{
  flushed: EnglishDocId[];
  errors: string[];
}> {
  const dirty = loadDirtyEnglishDocs(userId);
  if (dirty.length === 0 || !db || !userId || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { flushed: [], errors: [] };
  }

  const flushed: EnglishDocId[] = [];
  const errors: string[] = [];

  for (const docId of dirty) {
    const local = loadLocal<unknown>(userId, docId);
    if (!local) {
      clearEnglishDocDirty(userId, docId);
      continue;
    }

    try {
      if (docId === "state") {
        const parsed = englishStateDocSchema.safeParse(local);
        if (!parsed.success) {
          clearEnglishDocDirty(userId, docId);
          continue;
        }
        const res = await saveEnglishState(userId, parsed.data);
        if (res.savedRemote) flushed.push(docId);
        else if (res.error) errors.push(res.error);
      } else if (docId === "vocabulary") {
        const parsed = englishVocabularyDocSchema.safeParse(local);
        if (!parsed.success) {
          clearEnglishDocDirty(userId, docId);
          continue;
        }
        const res = await saveEnglishVocabulary(userId, parsed.data);
        if (res.savedRemote) flushed.push(docId);
        else if (res.error) errors.push(res.error);
      } else if (docId === "phrases") {
        const parsed = englishPhrasesDocSchema.safeParse(local);
        if (!parsed.success) {
          clearEnglishDocDirty(userId, docId);
          continue;
        }
        const res = await saveEnglishPhrases(userId, parsed.data);
        if (res.savedRemote) flushed.push(docId);
        else if (res.error) errors.push(res.error);
      } else if (docId === "mistakes") {
        const parsed = englishMistakesDocSchema.safeParse(local);
        if (!parsed.success) {
          clearEnglishDocDirty(userId, docId);
          continue;
        }
        const res = await saveEnglishMistakes(userId, parsed.data);
        if (res.savedRemote) flushed.push(docId);
        else if (res.error) errors.push(res.error);
      } else if (docId === "practice-journal") {
        const parsed = englishPracticeJournalDocSchema.safeParse(local);
        if (!parsed.success) {
          clearEnglishDocDirty(userId, docId);
          continue;
        }
        const res = await saveEnglishPracticeJournal(userId, parsed.data);
        if (res.savedRemote) flushed.push(docId);
        else if (res.error) errors.push(res.error);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Failed to sync ${docId}.`);
    }
  }

  return { flushed, errors };
}
