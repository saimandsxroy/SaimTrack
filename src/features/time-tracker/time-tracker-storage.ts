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

// ─── Shutdown snapshot helpers ──────────────────────────────────────────
// Written ONLY when this device's browser/tab closes (pagehide/beforeunload).
// On next load of this SAME device, if we find a shutdown snapshot, we recover
// the paused timer. We then clear it so future loads are treated normally.
function saveShutdownSnapshot(userId: string, state: TimeTrackerState) {
  try {
    if (typeof window === "undefined") return;
    const paused = pauseActiveTimer(state);
    localStorage.setItem(shutdownKey(userId), JSON.stringify(paused));
  } catch {
    // non-critical
  }
}

function loadShutdownSnapshot(userId: string): TimeTrackerState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(shutdownKey(userId));
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
// localStorage / shutdown snapshot is ONLY used when Firestore is unreachable.
// This means cross-device use is always correct: mobile opens the running
// Firestore timer unchanged; only the device that shut down recovers paused.
export async function loadTimeTrackerState(userId: string): Promise<TimeTrackerState> {
  // 1. Check for a shutdown snapshot left by THIS device on its last close.
  //    We'll use this only if Firestore is unreachable.
  const shutdownSnapshot = loadShutdownSnapshot(userId);

  // 2. Firestore is the source of truth — always use it if reachable.
  if (db && userId) {
    try {
      const docRef = doc(db, "users", userId, "time-tracker", "state");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const firestoreState = snap.data() as TimeTrackerState;

        // If this device left a shutdown snapshot AND Firestore still has the
        // timer as "running" (Firestore didn't get the paused update before
        // the browser died), recover the paused snapshot and sync it back.
        if (
          shutdownSnapshot?.activeTimer &&
          firestoreState.activeTimer?.id === shutdownSnapshot.activeTimer.id &&
          firestoreState.activeTimer.status === "running" &&
          shutdownSnapshot.activeTimer.status === "paused"
        ) {
          const recovered: TimeTrackerState = {
            ...firestoreState,
            activeTimer: shutdownSnapshot.activeTimer,
            customCategories: firestoreState.customCategories ?? shutdownSnapshot.customCategories ?? [],
          };
          clearShutdownSnapshot(userId);
          await setDoc(docRef, recovered, { merge: true });
          saveToLocalStorage(userId, recovered);
          return recovered;
        }

        // Normal case (cross-device, or no shutdown detected):
        // Trust Firestore completely. Running stays running.
        clearShutdownSnapshot(userId); // no longer needed
        saveToLocalStorage(userId, firestoreState);
        return firestoreState;
      }
    } catch (error) {
      console.error("Failed to load time tracker from Firestore:", error);
      // Fall through to offline fallback below
    }
  }

  // 3. Firestore unreachable — use shutdown snapshot first, then general localStorage.
  if (shutdownSnapshot) {
    clearShutdownSnapshot(userId);
    saveToLocalStorage(userId, shutdownSnapshot);
    return shutdownSnapshot;
  }

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

// ─── Shutdown checkpoint ────────────────────────────────────────────────
// Called ONLY from pagehide/beforeunload on THIS device.
// Saves a paused snapshot to the shutdown key so the NEXT load on this
// SAME device can detect and recover the paused timer.
// Other devices are unaffected because they don't share localStorage.
export function checkpointTimerToLocalStorage(userId: string, state: TimeTrackerState) {
  saveShutdownSnapshot(userId, state);   // paused snapshot — for shutdown recovery
  saveToLocalStorage(userId, state);     // running snapshot — for offline fallback
}
