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

export async function loadTimeTrackerState(userId: string): Promise<TimeTrackerState> {
  if (!db || !userId) return { entries: [], activeTimer: null };
  try {
    const docRef = doc(db, "users", userId, "time-tracker", "state");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as TimeTrackerState;
    }
  } catch (error) {
    console.error("Failed to load time tracker from Firestore:", error);
  }
  return { entries: [], activeTimer: null };
}

export async function saveTimeTrackerState(userId: string, state: TimeTrackerState) {
  if (!db || !userId) return;
  try {
    const docRef = doc(db, "users", userId, "time-tracker", "state");
    await setDoc(docRef, state, { merge: true });
  } catch (error) {
    console.error("Failed to save time tracker to Firestore:", error);
  }
}
