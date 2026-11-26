import { doc, getDoc, onSnapshot, runTransaction, setDoc, type Unsubscribe } from "firebase/firestore";
import type { ActiveTimer, TimeEntry } from "@/features/time-tracker/time-tracker-types";
import { db } from "@/lib/firebase";
import { deduplicateEntries, measurePayloadBytes, stripUndefined } from "@/lib/firestore-utils";

// Scoped by userId so different accounts on the same browser never collide.
function storageKey(userId: string) {
  return `careeros.time-tracker.v1.${userId}`;
}
function shutdownKey(userId: string) {
  return `careeros.time-tracker.shutdown.${userId}`;
}
function pendingOpsKey(userId: string) {
  return `careeros.time-tracker.pending.${userId}`;
}

export const TIME_TRACKER_WARN_BYTES = 750_000;
export const TIME_TRACKER_BLOCK_BYTES = 960_000;

export type TimeTrackerState = {
  entries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  customCategories?: string[];
};

export const defaultTimeTrackerState: TimeTrackerState = {
  entries: [],
  activeTimer: null,
  customCategories: [],
};

export type PendingTimeTrackerOp =
  | { type: "claimTimer"; timer: ActiveTimer; createdAt: number }
  | { type: "updateTimer"; timer: ActiveTimer | null; expectedTimerId?: string; createdAt: number }
  | { type: "stopTimer"; entry: TimeEntry; createdAt: number }
  | { type: "upsertEntry"; entry: TimeEntry; createdAt: number }
  | { type: "deleteEntry"; entryId: string; createdAt: number }
  | { type: "setCustomCategories"; customCategories: string[]; createdAt: number };

export class TimerConflictError extends Error {
  remoteActiveTimer: ActiveTimer;
  constructor(remoteActiveTimer: ActiveTimer, message?: string) {
    super(
      message ||
        `A "${remoteActiveTimer.title}" (${remoteActiveTimer.category}) session is already running in another tab or device.`,
    );
    this.name = "TimerConflictError";
    this.remoteActiveTimer = remoteActiveTimer;
  }
}

// ─── Pause active timer helper ─────────────────────────────────────────
export function pauseActiveTimer(state: TimeTrackerState, atTimestamp = Date.now()): TimeTrackerState {
  if (!state.activeTimer || state.activeTimer.status !== "running") {
    return state;
  }
  const runningSinceMs = new Date(state.activeTimer.runningSince).getTime();
  const additionalElapsed = Math.max(0, atTimestamp - runningSinceMs);
  const totalAccumulated = state.activeTimer.accumulatedMs + additionalElapsed;

  const prevIntervals = state.activeTimer.intervals ?? [];
  const nextIntervals =
    additionalElapsed > 0
      ? [...prevIntervals, { start: state.activeTimer.runningSince, end: new Date(atTimestamp).toISOString() }]
      : prevIntervals;

  return {
    ...state,
    activeTimer: {
      ...state.activeTimer,
      accumulatedMs: totalAccumulated,
      intervals: nextIntervals,
      status: "paused",
    },
  };
}

// ─── localStorage helpers ───────────────────────────────────────────────
function saveToLocalStorage(userId: string, state: TimeTrackerState) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // non-critical
  }
}

export function loadTimeTrackerFromLocalStorage(userId: string): TimeTrackerState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimeTrackerState;
    return {
      entries: deduplicateEntries(parsed.entries || []),
      activeTimer: parsed.activeTimer ?? null,
      customCategories: parsed.customCategories ?? [],
    };
  } catch {
    return null;
  }
}

export function loadPendingTimeTrackerOps(userId: string): PendingTimeTrackerOp[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(pendingOpsKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as PendingTimeTrackerOp[];
  } catch {
    return [];
  }
}

function savePendingTimeTrackerOps(userId: string, ops: PendingTimeTrackerOp[]) {
  try {
    if (typeof window === "undefined") return;
    if (ops.length === 0) {
      localStorage.removeItem(pendingOpsKey(userId));
    } else {
      localStorage.setItem(pendingOpsKey(userId), JSON.stringify(ops));
    }
  } catch {
    // non-critical
  }
}

export function enqueuePendingTimeTrackerOp(userId: string, op: PendingTimeTrackerOp) {
  const existing = loadPendingTimeTrackerOps(userId);
  savePendingTimeTrackerOps(userId, [...existing, op]);
}

function clearShutdownSnapshot(userId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(shutdownKey(userId));
  } catch {
    // non-critical
  }
}

export function getTimeTrackerDocMetrics(state: TimeTrackerState) {
  const bytes = measurePayloadBytes(state);
  return {
    bytes,
    percentOfLimit: Math.min(100, Math.round((bytes / 1_048_576) * 100)),
    nearLimit: bytes >= TIME_TRACKER_WARN_BYTES,
    overLimit: bytes >= TIME_TRACKER_BLOCK_BYTES,
  };
}

/**
 * Non-destructive backward-compatible archival helper:
 * If time-tracker/state approaches Firestore's 1 MiB ceiling, moves entries from completed prior years
 * to /users/{userId}/time-tracker/archive-{YYYY} and keeps recent entries in main state.
 */
async function archiveOldEntriesIfNeeded(userId: string, state: TimeTrackerState): Promise<TimeTrackerState> {
  if (!db) return state;
  const metrics = getTimeTrackerDocMetrics(state);
  if (!metrics.nearLimit) return state;

  const currentYear = new Date().getFullYear();
  const recent: TimeEntry[] = [];
  const byOldYear = new Map<number, TimeEntry[]>();

  for (const entry of state.entries) {
    const year = new Date(entry.date || entry.startTime).getFullYear();
    if (!Number.isNaN(year) && year < currentYear) {
      const list = byOldYear.get(year) ?? [];
      list.push(entry);
      byOldYear.set(year, list);
    } else {
      recent.push(entry);
    }
  }

  if (byOldYear.size === 0) return state;

  for (const [year, yearEntries] of byOldYear.entries()) {
    const archiveRef = doc(db, "users", userId, "time-tracker", `archive-${year}`);
    const snap = await getDoc(archiveRef);
    const existing = snap.exists() ? ((snap.data().entries as TimeEntry[]) ?? []) : [];
    const merged = deduplicateEntries([...yearEntries, ...existing]);
    await setDoc(
      archiveRef,
      stripUndefined({ year, entries: merged, updatedAt: new Date().toISOString() }),
      { merge: true },
    );
  }

  return { ...state, entries: recent };
}

function normalizeRemoteState(raw: Partial<TimeTrackerState> | undefined): TimeTrackerState {
  return stripUndefined({
    entries: deduplicateEntries(raw?.entries ?? []),
    activeTimer: raw?.activeTimer ?? null,
    customCategories: raw?.customCategories ?? [],
  });
}

// ─── Primary load ──────────────────────────────────────────────────────
export async function loadTimeTrackerState(userId: string): Promise<TimeTrackerState> {
  clearShutdownSnapshot(userId);

  if (db && userId) {
    try {
      const docRef = doc(db, "users", userId, "time-tracker", "state");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const firestoreState = normalizeRemoteState(snap.data() as Partial<TimeTrackerState>);
        saveToLocalStorage(userId, firestoreState);
        return firestoreState;
      }
    } catch (error) {
      console.error("Failed to load time tracker from Firestore:", error);
    }
  }

  const localState = loadTimeTrackerFromLocalStorage(userId);
  if (localState) {
    return localState;
  }

  return defaultTimeTrackerState;
}

// ─── Single realtime subscription ──────────────────────────────────────
export function subscribeTimeTrackerState(
  userId: string,
  onState: (state: TimeTrackerState, fromCache: boolean) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!db || !userId) {
    return () => {};
  }
  const docRef = doc(db, "users", userId, "time-tracker", "state");
  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.exists()) {
        const normalized = normalizeRemoteState(snap.data() as Partial<TimeTrackerState>);
        saveToLocalStorage(userId, normalized);
        onState(normalized, snap.metadata.fromCache);
      } else {
        onState(defaultTimeTrackerState, snap.metadata.fromCache);
      }
    },
    (error) => {
      console.error("Time tracker snapshot error:", error);
      onError?.(error);
    },
  );
}

// ─── Primary save (used by legacy callers & fallback) ───────────────────
export async function saveTimeTrackerState(userId: string, state: TimeTrackerState) {
  const normalized: TimeTrackerState = stripUndefined({
    entries: deduplicateEntries(state.entries),
    activeTimer: state.activeTimer ?? null,
    customCategories: state.customCategories ?? [],
  });
  saveToLocalStorage(userId, normalized);

  if (!db || !userId) return;
  try {
    const safeState = stripUndefined(await archiveOldEntriesIfNeeded(userId, normalized));
    const metrics = getTimeTrackerDocMetrics(safeState);
    if (metrics.overLimit) {
      throw new Error("Time tracker document exceeds Firestore safe size limit.");
    }
    const docRef = doc(db, "users", userId, "time-tracker", "state");
    await setDoc(docRef, safeState, { merge: true });
  } catch (error) {
    console.error("Failed to save time tracker to Firestore:", error);
    throw error;
  }
}

// ─── Transactional online operations ───────────────────────────────────
export async function claimActiveTimerTx(userId: string, timer: ActiveTimer): Promise<TimeTrackerState> {
  if (!db || !userId) throw new Error("Firestore not initialized.");
  const docRef = doc(db, "users", userId, "time-tracker", "state");
  const cleanTimer = stripUndefined(timer);

  const nextState = await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.exists()
      ? normalizeRemoteState(snap.data() as Partial<TimeTrackerState>)
      : defaultTimeTrackerState;

    if (current.activeTimer && current.activeTimer.id !== cleanTimer.id) {
      throw new TimerConflictError(current.activeTimer);
    }

    const updated: TimeTrackerState = stripUndefined({
      ...current,
      activeTimer: cleanTimer,
    });
    tx.set(docRef, updated, { merge: true });
    return updated;
  });

  saveToLocalStorage(userId, nextState);
  return nextState;
}

export async function updateActiveTimerTx(
  userId: string,
  updater: (currentTimer: ActiveTimer | null) => ActiveTimer | null,
): Promise<TimeTrackerState> {
  if (!db || !userId) throw new Error("Firestore not initialized.");
  const docRef = doc(db, "users", userId, "time-tracker", "state");

  const nextState = await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.exists()
      ? normalizeRemoteState(snap.data() as Partial<TimeTrackerState>)
      : defaultTimeTrackerState;

    const updated: TimeTrackerState = stripUndefined({
      ...current,
      activeTimer: updater(current.activeTimer),
    });
    tx.set(docRef, updated, { merge: true });
    return updated;
  });

  saveToLocalStorage(userId, nextState);
  return nextState;
}

export async function stopActiveTimerTx(userId: string, completedEntry: TimeEntry): Promise<TimeTrackerState> {
  if (!db || !userId) throw new Error("Firestore not initialized.");
  const docRef = doc(db, "users", userId, "time-tracker", "state");
  const cleanEntry = stripUndefined(completedEntry);

  const nextState = await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.exists()
      ? normalizeRemoteState(snap.data() as Partial<TimeTrackerState>)
      : defaultTimeTrackerState;

    const mergedEntries = deduplicateEntries([cleanEntry, ...current.entries]);
    const updated: TimeTrackerState = stripUndefined({
      ...current,
      entries: mergedEntries,
      activeTimer: null,
    });
    tx.set(docRef, updated, { merge: true });
    return updated;
  });

  const archived = stripUndefined(await archiveOldEntriesIfNeeded(userId, nextState));
  if (archived.entries.length !== nextState.entries.length) {
    const archivedIds = new Set(
      nextState.entries
        .filter((e) => !archived.entries.some((kept) => kept.id === e.id))
        .map((e) => e.id),
    );
    const pruned = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      const current = snap.exists()
        ? normalizeRemoteState(snap.data() as Partial<TimeTrackerState>)
        : defaultTimeTrackerState;
      const updated = stripUndefined({
        ...current,
        entries: current.entries.filter((e) => !archivedIds.has(e.id)),
      });
      tx.set(docRef, updated, { merge: true });
      return updated;
    });
    saveToLocalStorage(userId, pruned);
    return pruned;
  }

  saveToLocalStorage(userId, archived);
  return archived;
}

export async function mutateTimeTrackerEntriesTx(
  userId: string,
  mutator: (current: TimeTrackerState) => TimeTrackerState,
): Promise<TimeTrackerState> {
  if (!db || !userId) throw new Error("Firestore not initialized.");
  const docRef = doc(db, "users", userId, "time-tracker", "state");

  const nextState = await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const current = snap.exists()
      ? normalizeRemoteState(snap.data() as Partial<TimeTrackerState>)
      : defaultTimeTrackerState;

    const mutated = mutator(current);
    const updated: TimeTrackerState = stripUndefined({
      entries: deduplicateEntries(mutated.entries),
      activeTimer: mutated.activeTimer ?? current.activeTimer,
      customCategories: mutated.customCategories ?? current.customCategories ?? [],
    });
    tx.set(docRef, updated, { merge: true });
    return updated;
  });

  saveToLocalStorage(userId, nextState);
  return nextState;
}

// ─── Offline queue reconciliation on reconnect ─────────────────────────
export async function reconcilePendingTimeTrackerOps(userId: string): Promise<{
  state: TimeTrackerState;
  hadConflict: boolean;
  conflictTimer?: ActiveTimer;
}> {
  const ops = loadPendingTimeTrackerOps(userId);
  if (ops.length === 0 || !db || !userId) {
    const current = await loadTimeTrackerState(userId);
    return { state: current, hadConflict: false };
  }

  const docRef = doc(db, "users", userId, "time-tracker", "state");
  let hadConflict = false;
  let conflictTimer: ActiveTimer | undefined;

  const reconciled = await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    let current = snap.exists()
      ? normalizeRemoteState(snap.data() as Partial<TimeTrackerState>)
      : defaultTimeTrackerState;

    for (const op of ops) {
      if (op.type === "claimTimer") {
        if (current.activeTimer && current.activeTimer.id !== op.timer.id) {
          hadConflict = true;
          conflictTimer = current.activeTimer;
        } else {
          current = { ...current, activeTimer: op.timer };
        }
      } else if (op.type === "updateTimer") {
        const targetId = op.timer?.id ?? op.expectedTimerId;
        if (!current.activeTimer || (targetId && current.activeTimer.id === targetId)) {
          current = { ...current, activeTimer: op.timer };
        } else {
          hadConflict = true;
          conflictTimer = current.activeTimer;
        }
      } else if (op.type === "stopTimer") {
        const merged = deduplicateEntries([op.entry, ...current.entries]);
        const nextActive =
          current.activeTimer && current.activeTimer.id === op.entry.id ? null : current.activeTimer;
        current = { ...current, entries: merged, activeTimer: nextActive };
      } else if (op.type === "upsertEntry") {
        const idx = current.entries.findIndex((e) => e.id === op.entry.id);
        const nextEntries =
          idx >= 0
            ? current.entries.map((e) => (e.id === op.entry.id ? op.entry : e))
            : [op.entry, ...current.entries];
        current = { ...current, entries: deduplicateEntries(nextEntries) };
      } else if (op.type === "deleteEntry") {
        current = {
          ...current,
          entries: current.entries.filter((e) => e.id !== op.entryId),
        };
      } else if (op.type === "setCustomCategories") {
        const mergedCats = Array.from(
          new Set([...(current.customCategories ?? []), ...op.customCategories]),
        );
        current = { ...current, customCategories: mergedCats };
      }
    }

    const cleanCurrent = stripUndefined(current);
    tx.set(docRef, cleanCurrent, { merge: true });
    return cleanCurrent;
  });

  savePendingTimeTrackerOps(userId, []);
  saveToLocalStorage(userId, reconciled);
  return { state: reconciled, hadConflict, conflictTimer };
}

export function checkpointTimerToLocalStorage(userId: string, state: TimeTrackerState) {
  saveToLocalStorage(userId, state);
}
