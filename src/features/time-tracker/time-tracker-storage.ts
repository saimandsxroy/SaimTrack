import { doc, getDoc, setDoc } from "firebase/firestore";
import type { ActiveTimer, TimeEntry } from "@/features/time-tracker/time-tracker-types";

// Scoped by userId so different accounts on the same browser never collide.
function storageKey(userId: string) { return `careeros.time-tracker.v1.${userId}`; }
// Separate key to store the shutdown-paused snapshot.
// This is ONLY written on pagehide/beforeunload and cleared after recovery.
// It is never written on a normal cross-device open.
function shutdownKey(userId: string) { return `careeros.time-tracker.shutdown.${userId}`; }
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

// ─── localStorage helpers ───────────────────────────────────────────────
function saveToLocalStorage(userId: string, state: TimeTrackerState) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // non-critical
  }
}

function loadFromLocalStorage(userId: string): TimeTrackerState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as TimeTrackerState;
  } catch {
    return null;
  }
}



function clearShutdownSnapshot(userId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(shutdownKey(userId));
  } catch {
    // non-critical
  }
}

// ─── Primary load ──────────────────────────────────────────────────────
// Rule: Firestore is ALWAYS authoritative when reachable.
// localStorage is used for offline fallback and fast local cache.
// A running timer stays running across tab closes, browser reloads, and other devices.
export async function loadTimeTrackerState(userId: string): Promise<TimeTrackerState> {
  // Clean up any legacy shutdown snapshot so it doesn't cause stray pauses
  clearShutdownSnapshot(userId);

  // 1. Firestore is the source of truth — always use it if reachable.
  if (db && userId) {
    try {
      const docRef = doc(db, "users", userId, "time-tracker", "state");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const firestoreState = snap.data() as TimeTrackerState;
        saveToLocalStorage(userId, firestoreState);
        return firestoreState;
      }
    } catch (error) {
      console.error("Failed to load time tracker from Firestore:", error);
      // Fall through to offline fallback below
    }
  }

  // 2. Firestore unreachable — use local storage fallback.
  const localState = loadFromLocalStorage(userId);
  if (localState) {
    return localState;
  }

  return defaultTimeTrackerState;
}

// ─── Primary save: Firestore + localStorage ────────────────────────────
export async function saveTimeTrackerState(userId: string, state: TimeTrackerState) {
  // Keep localStorage in sync for offline fallback
  saveToLocalStorage(userId, state);

  if (!db || !userId) return;
  try {
    const docRef = doc(db, "users", userId, "time-tracker", "state");
    await setDoc(docRef, state, { merge: true });
  } catch (error) {
    console.error("Failed to save time tracker to Firestore:", error);
  }
}

// ─── Tab close / reload checkpoint ──────────────────────────────────────
// Keeps localStorage up-to-date with current state (running or paused)
// so closing or reopening a tab does not lose or pause running timers.
export function checkpointTimerToLocalStorage(userId: string, state: TimeTrackerState) {
  saveToLocalStorage(userId, state);
}
