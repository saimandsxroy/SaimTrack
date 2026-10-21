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

// ─── localStorage backup helpers ───────────────────────────────────────
// These act as an instant, offline-safe fallback so the active timer
// survives abrupt shutdowns (e.g. Windows power-off, browser crash).

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

// ─── Primary load: Firestore first, localStorage fallback ──────────────

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

        // If localStorage has a running/paused timer but Firestore doesn't,
        // the timer was lost due to an abrupt shutdown — recover it.
        if (
          localState?.activeTimer &&
          !firestoreState.activeTimer
        ) {
          const recovered: TimeTrackerState = {
            ...firestoreState,
            activeTimer: localState.activeTimer,
            customCategories: firestoreState.customCategories ?? localState.customCategories ?? [],
          };
          // Persist the recovered timer back to Firestore
          await setDoc(docRef, recovered, { merge: true });
          saveToLocalStorage(recovered);
          return recovered;
        }

        // Normal case — sync localStorage with Firestore
        saveToLocalStorage(firestoreState);
        return firestoreState;
      }
    } catch (error) {
      console.error("Failed to load time tracker from Firestore:", error);
      // Firestore failed (offline / cold-start) — fall through to localStorage
    }
  }

  // 3. Firestore unavailable — return localStorage if we have it
  if (localState) {
    return localState;
  }

  return { entries: [], activeTimer: null };
}

// ─── Primary save: Firestore + localStorage ────────────────────────────

export async function saveTimeTrackerState(userId: string, state: TimeTrackerState) {
  // Always write to localStorage first (synchronous, survives crashes)
  saveToLocalStorage(state);

  if (!db || !userId) return;
  try {
    const docRef = doc(db, "users", userId, "time-tracker", "state");
    await setDoc(docRef, state, { merge: true });
  } catch (error) {
    console.error("Failed to save time tracker to Firestore:", error);
  }
}

// ─── Emergency checkpoint (called from pagehide/beforeunload) ──────────
// This writes ONLY to localStorage since Firestore setDoc is async and
// won't complete before the browser kills the page.

export function checkpointTimerToLocalStorage(state: TimeTrackerState) {
  saveToLocalStorage(state);
}
