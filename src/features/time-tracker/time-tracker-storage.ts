import { doc, getDoc, setDoc } from "firebase/firestore";
import type { ActiveTimer, TimeEntry } from "@/features/time-tracker/time-tracker-types";

const STORAGE_KEY = "careeros.time-tracker.v1";
import { db } from "@/lib/firebase";

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

// ─── Pause active timer helper ─────────────────────────────────────────
// Freezes the accumulated elapsed time up to `atTimestamp` and sets status to "paused"
export function pauseActiveTimer(state: TimeTrackerState, atTimestamp = Date.now()): TimeTrackerState {
  if (!state.activeTimer || state.activeTimer.status !== "running") {
    return state;
  }
  const runningSinceMs = new Date(state.activeTimer.runningSince).getTime();
  const additionalElapsed = Math.max(0, atTimestamp - runningSinceMs);
  const totalAccumulated = state.activeTimer.accumulatedMs + additionalElapsed;

  return {
    ...state,
    activeTimer: {
      ...state.activeTimer,
      accumulatedMs: totalAccumulated,
      status: "paused",
    },
  };
}

// ─── localStorage backup helpers ───────────────────────────────────────
function saveToLocalStorage(state: TimeTrackerState) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled — non-critical
  }
}

function loadFromLocalStorage(): TimeTrackerState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimeTrackerState;
  } catch {
    return null;
  }
}

// ─── Primary load: Firestore + localStorage with Auto-Pause on reopen ───
export async function loadTimeTrackerState(userId: string): Promise<TimeTrackerState> {
  // 1. Try to load from localStorage immediately (instant, offline-safe)
  const localState = loadFromLocalStorage();

  // 2. Try Firestore (authoritative source)
  if (db && userId) {
    try {
      const docRef = doc(db, "users", userId, "time-tracker", "state");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const firestoreState = snap.data() as TimeTrackerState;

        // If localStorage has an activeTimer saved before shutdown/page-close:
        // Use it because it captured the exact moment of shutdown as PAUSED.
        if (localState?.activeTimer) {
          const pausedTimer = localState.activeTimer.status === "running"
            ? pauseActiveTimer(localState).activeTimer
            : localState.activeTimer;

          const recovered: TimeTrackerState = {
            ...firestoreState,
            activeTimer: pausedTimer,
            customCategories: firestoreState.customCategories ?? localState.customCategories ?? [],
          };
          await setDoc(docRef, recovered, { merge: true });
          saveToLocalStorage(recovered);
          return recovered;
        }

        // If Firestore had an activeTimer that was still marked "running" before shutdown,
        // freeze it and pause it so it doesn't count hours while the PC was off.
        if (firestoreState.activeTimer && firestoreState.activeTimer.status === "running") {
          const pausedFirestoreState = pauseActiveTimer(firestoreState);
          await setDoc(docRef, pausedFirestoreState, { merge: true });
          saveToLocalStorage(pausedFirestoreState);
          return pausedFirestoreState;
        }

        saveToLocalStorage(firestoreState);
        return firestoreState;
      }
    } catch (error) {
      console.error("Failed to load time tracker from Firestore:", error);
    }
  }

  // 3. Firestore unavailable — return localStorage (paused if it was running)
  if (localState) {
    if (localState.activeTimer && localState.activeTimer.status === "running") {
      const paused = pauseActiveTimer(localState);
      saveToLocalStorage(paused);
      return paused;
    }
    return localState;
  }

  return { entries: [], activeTimer: null };
}

// ─── Primary save: Firestore + localStorage ────────────────────────────
export async function saveTimeTrackerState(userId: string, state: TimeTrackerState) {
  saveToLocalStorage(state);

  if (!db || !userId) return;
  try {
    const docRef = doc(db, "users", userId, "time-tracker", "state");
    await setDoc(docRef, state, { merge: true });
  } catch (error) {
    console.error("Failed to save time tracker to Firestore:", error);
  }
}

// ─── Emergency checkpoint (called on pagehide / beforeunload / interval) ─
// Pauses the timer and writes to localStorage immediately so shutdown freezes the time
export function checkpointTimerToLocalStorage(state: TimeTrackerState) {
  const pausedState = pauseActiveTimer(state);
  saveToLocalStorage(pausedState);
}
