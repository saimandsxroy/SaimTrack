"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";
import {
  checkpointTimerToLocalStorage,
  claimActiveTimerTx,
  defaultTimeTrackerState,
  enqueuePendingTimeTrackerOp,
  getTimeTrackerDocMetrics,
  loadPendingTimeTrackerOps,
  loadTimeTrackerFromLocalStorage,
  loadTimeTrackerState,
  mutateTimeTrackerEntriesTx,
  reconcilePendingTimeTrackerOps,
  saveTimeTrackerState,
  stopActiveTimerTx,
  subscribeTimeTrackerState,
  TimerConflictError,
  updateActiveTimerTx,
  type TimeTrackerState,
} from "@/features/time-tracker/time-tracker-storage";
import { formatDuration } from "@/features/time-tracker/time-tracker-utils";
import type {
  ActiveTimer,
  TimeCategory,
  TimeEntry,
  TimerInterval,
} from "@/features/time-tracker/time-tracker-types";

export type SyncStatus = "synced" | "syncing" | "pending" | "offline" | "error";

export type StartTimerInput = {
  title: string;
  category: TimeCategory;
  notes?: string;
  module?: string;
  subcategory?: string;
};

type TimeTrackerContextValue = {
  hydrated: boolean;
  entries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  customCategories: string[];
  liveDuration: number;
  now: number;
  syncStatus: SyncStatus;
  syncMessage: string | null;
  pendingCount: number;
  docMetrics: ReturnType<typeof getTimeTrackerDocMetrics>;
  startTimer: (input: StartTimerInput) => Promise<boolean>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<TimeEntry | null>;
  discardTimer: () => Promise<void>;
  updateActiveTimerMeta: (patch: Partial<Pick<ActiveTimer, "title" | "category" | "notes" | "subcategory">>) => void;
  addManualEntry: (entry: Omit<TimeEntry, "id"> & { id?: string }) => Promise<TimeEntry | null>;
  updateEntry: (entry: TimeEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addCustomCategory: (name: string) => Promise<void>;
  resetWorkspace: () => Promise<void>;
  retrySync: () => Promise<void>;
};

const TimeTrackerContext = createContext<TimeTrackerContextValue | undefined>(undefined);

function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("offline") ||
    msg.includes("unavailable") ||
    msg.includes("network") ||
    msg.includes("failed to get document")
  );
}

export function TimeTrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const stateRef = useRef<TimeTrackerState>({ entries, activeTimer, customCategories });
  useEffect(() => {
    stateRef.current = { entries, activeTimer, customCategories };
  }, [entries, activeTimer, customCategories]);

  const hydratedRef = useRef(false);
  useEffect(() => {
    hydratedRef.current = hydrated;
  }, [hydrated]);

  const applyLocalState = useCallback((next: TimeTrackerState) => {
    setEntries(next.entries);
    setActiveTimer(next.activeTimer);
    setCustomCategories(next.customCategories ?? []);
  }, []);

  const refreshPendingCount = useCallback((userId: string) => {
    setPendingCount(loadPendingTimeTrackerOps(userId).length);
  }, []);

  const performReconcile = useCallback(
    async (userId: string) => {
      const pending = loadPendingTimeTrackerOps(userId);
      if (pending.length === 0) {
        setPendingCount(0);
        if (typeof navigator === "undefined" || navigator.onLine) {
          setSyncStatus("synced");
          setSyncMessage(null);
        }
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSyncStatus("offline");
        setPendingCount(pending.length);
        setSyncMessage(`${pending.length} change(s) queued offline.`);
        return;
      }

      setSyncStatus("syncing");
      try {
        const result = await reconcilePendingTimeTrackerOps(userId);
        applyLocalState(result.state);
        setPendingCount(0);
        setSyncStatus("synced");
        setSyncMessage(null);
        if (result.hadConflict && result.conflictTimer) {
          toast.warning(
            `Sync conflict resolved: "${result.conflictTimer.title}" from another device remained active.`,
          );
        }
      } catch (err) {
        if (isNetworkFailure(err)) {
          setSyncStatus("offline");
          setSyncMessage("Waiting for connection to sync pending changes.");
        } else {
          setSyncStatus("error");
          setSyncMessage(err instanceof Error ? err.message : "Failed to reconcile pending writes.");
        }
      }
    },
    [applyLocalState],
  );

  // ─── Single Firestore subscription & initial localStorage hydration ───
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setActiveTimer(null);
      setCustomCategories([]);
      setHydrated(false);
      return;
    }

    const userId = user.uid;
    const cached = loadTimeTrackerFromLocalStorage(userId);
    if (cached) {
      applyLocalState(cached);
    }
    refreshPendingCount(userId);

    let active = true;

    async function bootstrap() {
      const pending = loadPendingTimeTrackerOps(userId);
      if (pending.length > 0 && (typeof navigator === "undefined" || navigator.onLine)) {
        await performReconcile(userId);
      } else {
        const initial = await loadTimeTrackerState(userId);
        if (active) applyLocalState(initial);
      }
      if (active) setHydrated(true);
    }

    bootstrap();

    const unsubscribe = subscribeTimeTrackerState(
      userId,
      (remoteState, fromCache) => {
        if (!active) return;
        const pending = loadPendingTimeTrackerOps(userId);
        if (pending.length > 0) {
          setPendingCount(pending.length);
          setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
          return;
        }
        applyLocalState(remoteState);
        setHydrated(true);
        if (!fromCache) {
          setSyncStatus("synced");
          setSyncMessage(null);
        }
      },
      (err) => {
        if (!active) return;
        setSyncStatus("error");
        setSyncMessage(err.message);
      },
    );

    const handleOnline = () => {
      performReconcile(userId);
    };
    const handleOffline = () => {
      setSyncStatus("offline");
      setSyncMessage("Offline mode — changes are cached locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user, applyLocalState, performReconcile, refreshPendingCount]);

  // ─── Checkpoint to localStorage on pagehide / beforeunload ────────────
  useEffect(() => {
    function checkpoint() {
      if (!user || !hydratedRef.current) return;
      checkpointTimerToLocalStorage(user.uid, stateRef.current);
    }
    window.addEventListener("pagehide", checkpoint);
    window.addEventListener("beforeunload", checkpoint);
    return () => {
      window.removeEventListener("pagehide", checkpoint);
      window.removeEventListener("beforeunload", checkpoint);
    };
  }, [user]);

  // ─── Single Web Worker ticker & visibility resync ────────────────────
  const activeStatus = activeTimer?.status;
  useEffect(() => {
    if (activeStatus !== "running") return;

    let worker: Worker | null = null;
    let workerUrl: string | null = null;
    let fallbackInterval: number | null = null;

    try {
      const workerBlob = new Blob(
        [
          `
          let timerId = null;
          self.onmessage = function(e) {
            if (e.data === "start") {
              if (timerId) clearInterval(timerId);
              timerId = setInterval(() => self.postMessage("tick"), 1000);
            } else if (e.data === "stop") {
              if (timerId) clearInterval(timerId);
              timerId = null;
            }
          };
          self.postMessage("ready");
          `,
        ],
        { type: "application/javascript" },
      );
      workerUrl = URL.createObjectURL(workerBlob);
      worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        if (e.data === "ready") {
          worker?.postMessage("start");
        } else if (e.data === "tick") {
          setNow(Date.now());
        }
      };
    } catch {
      fallbackInterval = window.setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }

    const handleVisibility = () => {
      setNow(Date.now());
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    const checkpointInterval = window.setInterval(() => {
      if (user && hydratedRef.current) {
        checkpointTimerToLocalStorage(user.uid, stateRef.current);
      }
    }, 10_000);

    return () => {
      if (worker) {
        worker.postMessage("stop");
        worker.terminate();
      }
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
      }
      if (fallbackInterval) {
        window.clearInterval(fallbackInterval);
      }
      window.clearInterval(checkpointInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [activeStatus, user]);

  const liveDuration = useMemo(() => {
    if (!activeTimer) return 0;
    const runningExtra =
      activeTimer.status === "running"
        ? Math.max(0, now - new Date(activeTimer.runningSince).getTime())
        : 0;
    return activeTimer.accumulatedMs + runningExtra;
  }, [activeTimer, now]);

  // ─── Global tab title sync while timer is active ─────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeTimer && activeTimer.status === "running") {
      document.title = `(${formatDuration(liveDuration)}) ${activeTimer.title} - SaimTrack`;
    } else if (activeTimer && activeTimer.status === "paused") {
      document.title = `[Paused] ${activeTimer.title} - SaimTrack`;
    } else {
      document.title = "SaimTrack";
    }
  }, [activeTimer, liveDuration]);

  // ─── Timer actions with online transactions + offline fallback ───────
  const startTimer = useCallback(
    async (input: StartTimerInput): Promise<boolean> => {
      if (!user) return false;
      if (stateRef.current.activeTimer) {
        toast.warning(
          `Finish or discard "${stateRef.current.activeTimer.title}" before starting a new timer.`,
        );
        return false;
      }

      const currentIso = new Date().toISOString();
      setNow(Date.now());

      const timer: ActiveTimer = {
        id: crypto.randomUUID(),
        title: input.title.trim() || "Focused study session",
        category: input.category,
        startTime: currentIso,
        runningSince: currentIso,
        accumulatedMs: 0,
        status: "running",
        intervals: [],
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        ...(input.module ? { module: input.module } : {}),
        ...(input.subcategory ? { subcategory: input.subcategory } : {}),
      };

      const optimistic: TimeTrackerState = { ...stateRef.current, activeTimer: timer };
      applyLocalState(optimistic);
      checkpointTimerToLocalStorage(user.uid, optimistic);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "claimTimer", timer, createdAt: Date.now() });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
        setSyncMessage("Timer started offline; will sync when reconnected.");
        toast.success("Timer started (offline mode).");
        return true;
      }

      setSyncStatus("syncing");
      try {
        const committed = await claimActiveTimerTx(user.uid, timer);
        applyLocalState(committed);
        setSyncStatus("synced");
        setSyncMessage(null);
        toast.success("Timer started.");
        return true;
      } catch (err) {
        if (err instanceof TimerConflictError) {
          const synced = { ...stateRef.current, activeTimer: err.remoteActiveTimer };
          applyLocalState(synced);
          checkpointTimerToLocalStorage(user.uid, synced);
          setSyncStatus("synced");
          toast.error(err.message);
          return false;
        }
        if (isNetworkFailure(err)) {
          enqueuePendingTimeTrackerOp(user.uid, { type: "claimTimer", timer, createdAt: Date.now() });
          refreshPendingCount(user.uid);
          setSyncStatus("offline");
          toast.success("Timer started (queued offline).");
          return true;
        }
        setSyncStatus("error");
        setSyncMessage(err instanceof Error ? err.message : "Failed to start timer.");
        toast.error("Could not start timer.");
        return false;
      }
    },
    [user, applyLocalState, refreshPendingCount],
  );

  const pauseTimer = useCallback(async () => {
    const currentTimer = stateRef.current.activeTimer;
    if (!user || !currentTimer || currentTimer.status !== "running") return;

    const pauseMs = Date.now();
    const pauseIso = new Date(pauseMs).toISOString();
    const runningSinceMs = new Date(currentTimer.runningSince).getTime();
    const delta = Math.max(0, pauseMs - runningSinceMs);

    const prevIntervals = currentTimer.intervals ?? [];
    const nextIntervals: TimerInterval[] =
      delta > 0 ? [...prevIntervals, { start: currentTimer.runningSince, end: pauseIso }] : prevIntervals;

    const pausedTimer: ActiveTimer = {
      ...currentTimer,
      accumulatedMs: currentTimer.accumulatedMs + delta,
      intervals: nextIntervals,
      status: "paused",
    };

    const optimistic: TimeTrackerState = { ...stateRef.current, activeTimer: pausedTimer };
    applyLocalState(optimistic);
    checkpointTimerToLocalStorage(user.uid, optimistic);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueuePendingTimeTrackerOp(user.uid, { type: "updateTimer", timer: pausedTimer, createdAt: pauseMs });
      refreshPendingCount(user.uid);
      setSyncStatus("offline");
      toast.success("Timer paused (offline).");
      return;
    }

    setSyncStatus("syncing");
    try {
      await updateActiveTimerTx(user.uid, (remote) => {
        if (!remote || remote.id !== pausedTimer.id) return remote;
        return pausedTimer;
      });
      setSyncStatus("synced");
      toast.success("Timer paused.");
    } catch (err) {
      if (isNetworkFailure(err)) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "updateTimer", timer: pausedTimer, createdAt: pauseMs });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
      } else {
        setSyncStatus("error");
        setSyncMessage(err instanceof Error ? err.message : "Failed to pause timer.");
      }
      toast.success("Timer paused locally.");
    }
  }, [user, applyLocalState, refreshPendingCount]);

  const resumeTimer = useCallback(async () => {
    const currentTimer = stateRef.current.activeTimer;
    if (!user || !currentTimer || currentTimer.status !== "paused") return;

    const resumeMs = Date.now();
    setNow(resumeMs);
    const resumedTimer: ActiveTimer = {
      ...currentTimer,
      runningSince: new Date(resumeMs).toISOString(),
      status: "running",
    };

    const optimistic: TimeTrackerState = { ...stateRef.current, activeTimer: resumedTimer };
    applyLocalState(optimistic);
    checkpointTimerToLocalStorage(user.uid, optimistic);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueuePendingTimeTrackerOp(user.uid, { type: "updateTimer", timer: resumedTimer, createdAt: resumeMs });
      refreshPendingCount(user.uid);
      setSyncStatus("offline");
      toast.success("Timer resumed (offline).");
      return;
    }

    setSyncStatus("syncing");
    try {
      await updateActiveTimerTx(user.uid, (remote) => {
        if (!remote || remote.id !== resumedTimer.id) return remote;
        return resumedTimer;
      });
      setSyncStatus("synced");
      toast.success("Timer resumed.");
    } catch (err) {
      if (isNetworkFailure(err)) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "updateTimer", timer: resumedTimer, createdAt: resumeMs });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
      } else {
        setSyncStatus("error");
      }
      toast.success("Timer resumed locally.");
    }
  }, [user, applyLocalState, refreshPendingCount]);

  const stopTimer = useCallback(async (): Promise<TimeEntry | null> => {
    const currentTimer = stateRef.current.activeTimer;
    if (!user || !currentTimer) return null;

    const endMs = Date.now();
    const endIso = new Date(endMs).toISOString();
    const runningExtra =
      currentTimer.status === "running"
        ? Math.max(0, endMs - new Date(currentTimer.runningSince).getTime())
        : 0;
    const completedDuration = currentTimer.accumulatedMs + runningExtra;

    const prevIntervals = currentTimer.intervals ?? [];
    const finalIntervals: TimerInterval[] =
      currentTimer.status === "running" && runningExtra > 0
        ? [...prevIntervals, { start: currentTimer.runningSince, end: endIso }]
        : prevIntervals;

    const completedEntry: TimeEntry = {
      id: currentTimer.id,
      title: currentTimer.title,
      category: currentTimer.category,
      startTime: currentTimer.startTime,
      endTime: endIso,
      duration: completedDuration,
      date: currentTimer.startTime,
      ...(currentTimer.notes ? { notes: currentTimer.notes } : {}),
      ...(currentTimer.module ? { module: currentTimer.module } : {}),
      ...(currentTimer.subcategory ? { subcategory: currentTimer.subcategory } : {}),
      ...(finalIntervals.length > 0 ? { intervals: finalIntervals } : {}),
    };

    const nextEntries = [
      completedEntry,
      ...stateRef.current.entries.filter((e) => e.id !== completedEntry.id),
    ];
    const optimistic: TimeTrackerState = {
      ...stateRef.current,
      entries: nextEntries,
      activeTimer: null,
    };
    applyLocalState(optimistic);
    checkpointTimerToLocalStorage(user.uid, optimistic);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueuePendingTimeTrackerOp(user.uid, { type: "stopTimer", entry: completedEntry, createdAt: endMs });
      refreshPendingCount(user.uid);
      setSyncStatus("offline");
      toast.success("Session saved offline; will sync when online.");
      return completedEntry;
    }

    setSyncStatus("syncing");
    try {
      const committed = await stopActiveTimerTx(user.uid, completedEntry);
      applyLocalState(committed);
      setSyncStatus("synced");
      setSyncMessage(null);
      toast.success("Session saved.");
      return completedEntry;
    } catch (err) {
      if (isNetworkFailure(err)) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "stopTimer", entry: completedEntry, createdAt: endMs });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
        toast.success("Session cached locally (offline).");
        return completedEntry;
      }
      setSyncStatus("error");
      setSyncMessage(err instanceof Error ? err.message : "Failed to save session.");
      toast.error("Failed to sync session to cloud; saved locally.");
      return completedEntry;
    }
  }, [user, applyLocalState, refreshPendingCount]);

  const discardTimer = useCallback(async () => {
    if (!user || !stateRef.current.activeTimer) return;
    const optimistic: TimeTrackerState = { ...stateRef.current, activeTimer: null };
    applyLocalState(optimistic);
    checkpointTimerToLocalStorage(user.uid, optimistic);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueuePendingTimeTrackerOp(user.uid, { type: "updateTimer", timer: null, createdAt: Date.now() });
      refreshPendingCount(user.uid);
      setSyncStatus("offline");
      toast.message("Timer discarded.");
      return;
    }

    setSyncStatus("syncing");
    try {
      await updateActiveTimerTx(user.uid, () => null);
      setSyncStatus("synced");
      toast.message("Timer discarded.");
    } catch (err) {
      if (isNetworkFailure(err)) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "updateTimer", timer: null, createdAt: Date.now() });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
      } else {
        setSyncStatus("error");
      }
      toast.message("Timer discarded.");
    }
  }, [user, applyLocalState, refreshPendingCount]);

  const updateActiveTimerMeta = useCallback(
    (patch: Partial<Pick<ActiveTimer, "title" | "category" | "notes" | "subcategory">>) => {
      if (!user || !stateRef.current.activeTimer) return;
      const nextTimer: ActiveTimer = { ...stateRef.current.activeTimer, ...patch };
      const optimistic = { ...stateRef.current, activeTimer: nextTimer };
      applyLocalState(optimistic);
      checkpointTimerToLocalStorage(user.uid, optimistic);
    },
    [user, applyLocalState],
  );

  const addManualEntry = useCallback(
    async (entryInput: Omit<TimeEntry, "id"> & { id?: string }): Promise<TimeEntry | null> => {
      if (!user) return null;
      const newEntry: TimeEntry = {
        ...entryInput,
        id: entryInput.id || crypto.randomUUID(),
      };
      const nextEntries = [newEntry, ...stateRef.current.entries.filter((e) => e.id !== newEntry.id)];
      const optimistic: TimeTrackerState = { ...stateRef.current, entries: nextEntries };
      applyLocalState(optimistic);
      checkpointTimerToLocalStorage(user.uid, optimistic);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "upsertEntry", entry: newEntry, createdAt: Date.now() });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
        toast.success("Manual session saved offline.");
        return newEntry;
      }

      setSyncStatus("syncing");
      try {
        const committed = await mutateTimeTrackerEntriesTx(user.uid, (cur) => ({
          ...cur,
          entries: [newEntry, ...cur.entries.filter((e) => e.id !== newEntry.id)],
        }));
        applyLocalState(committed);
        setSyncStatus("synced");
        toast.success("Manual session added.");
        return newEntry;
      } catch (err) {
        if (isNetworkFailure(err)) {
          enqueuePendingTimeTrackerOp(user.uid, { type: "upsertEntry", entry: newEntry, createdAt: Date.now() });
          refreshPendingCount(user.uid);
          setSyncStatus("offline");
        } else {
          setSyncStatus("error");
        }
        return newEntry;
      }
    },
    [user, applyLocalState, refreshPendingCount],
  );

  const updateEntry = useCallback(
    async (updatedEntry: TimeEntry) => {
      if (!user) return;
      const nextEntries = stateRef.current.entries.map((e) =>
        e.id === updatedEntry.id ? updatedEntry : e,
      );
      const optimistic: TimeTrackerState = { ...stateRef.current, entries: nextEntries };
      applyLocalState(optimistic);
      checkpointTimerToLocalStorage(user.uid, optimistic);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "upsertEntry", entry: updatedEntry, createdAt: Date.now() });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
        toast.success("Session updated offline.");
        return;
      }

      setSyncStatus("syncing");
      try {
        const committed = await mutateTimeTrackerEntriesTx(user.uid, (cur) => ({
          ...cur,
          entries: cur.entries.map((e) => (e.id === updatedEntry.id ? updatedEntry : e)),
        }));
        applyLocalState(committed);
        setSyncStatus("synced");
        toast.success("Session updated.");
      } catch (err) {
        if (isNetworkFailure(err)) {
          enqueuePendingTimeTrackerOp(user.uid, { type: "upsertEntry", entry: updatedEntry, createdAt: Date.now() });
          refreshPendingCount(user.uid);
          setSyncStatus("offline");
        } else {
          setSyncStatus("error");
        }
      }
    },
    [user, applyLocalState, refreshPendingCount],
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user) return;
      const nextEntries = stateRef.current.entries.filter((e) => e.id !== id);
      const optimistic: TimeTrackerState = { ...stateRef.current, entries: nextEntries };
      applyLocalState(optimistic);
      checkpointTimerToLocalStorage(user.uid, optimistic);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueuePendingTimeTrackerOp(user.uid, { type: "deleteEntry", entryId: id, createdAt: Date.now() });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
        toast.success("Session removed offline.");
        return;
      }

      setSyncStatus("syncing");
      try {
        const committed = await mutateTimeTrackerEntriesTx(user.uid, (cur) => ({
          ...cur,
          entries: cur.entries.filter((e) => e.id !== id),
        }));
        applyLocalState(committed);
        setSyncStatus("synced");
        toast.success("Session removed.");
      } catch (err) {
        if (isNetworkFailure(err)) {
          enqueuePendingTimeTrackerOp(user.uid, { type: "deleteEntry", entryId: id, createdAt: Date.now() });
          refreshPendingCount(user.uid);
          setSyncStatus("offline");
        } else {
          setSyncStatus("error");
        }
      }
    },
    [user, applyLocalState, refreshPendingCount],
  );

  const addCustomCategory = useCallback(
    async (name: string) => {
      if (!user) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const nextCats = Array.from(new Set([...(stateRef.current.customCategories ?? []), trimmed]));
      const optimistic: TimeTrackerState = { ...stateRef.current, customCategories: nextCats };
      applyLocalState(optimistic);
      checkpointTimerToLocalStorage(user.uid, optimistic);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueuePendingTimeTrackerOp(user.uid, {
          type: "setCustomCategories",
          customCategories: nextCats,
          createdAt: Date.now(),
        });
        refreshPendingCount(user.uid);
        setSyncStatus("offline");
        return;
      }

      try {
        await mutateTimeTrackerEntriesTx(user.uid, (cur) => ({
          ...cur,
          customCategories: Array.from(new Set([...(cur.customCategories ?? []), trimmed])),
        }));
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    },
    [user, applyLocalState, refreshPendingCount],
  );

  const resetWorkspace = useCallback(async () => {
    if (!user) return;
    applyLocalState(defaultTimeTrackerState);
    checkpointTimerToLocalStorage(user.uid, defaultTimeTrackerState);
    try {
      await saveTimeTrackerState(user.uid, defaultTimeTrackerState);
      toast.message("Workspace cleared.");
    } catch {
      toast.error("Failed to reset remote workspace.");
    }
  }, [user, applyLocalState]);

  const retrySync = useCallback(async () => {
    if (!user) return;
    await performReconcile(user.uid);
  }, [user, performReconcile]);

  const docMetrics = useMemo(
    () => getTimeTrackerDocMetrics({ entries, activeTimer, customCategories }),
    [entries, activeTimer, customCategories],
  );

  const value = useMemo<TimeTrackerContextValue>(
    () => ({
      hydrated,
      entries,
      activeTimer,
      customCategories,
      liveDuration,
      now,
      syncStatus,
      syncMessage,
      pendingCount,
      docMetrics,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      discardTimer,
      updateActiveTimerMeta,
      addManualEntry,
      updateEntry,
      deleteEntry,
      addCustomCategory,
      resetWorkspace,
      retrySync,
    }),
    [
      hydrated,
      entries,
      activeTimer,
      customCategories,
      liveDuration,
      now,
      syncStatus,
      syncMessage,
      pendingCount,
      docMetrics,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      discardTimer,
      updateActiveTimerMeta,
      addManualEntry,
      updateEntry,
      deleteEntry,
      addCustomCategory,
      resetWorkspace,
      retrySync,
    ],
  );

  return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
}

export function useTimeTracker() {
  const ctx = useContext(TimeTrackerContext);
  if (!ctx) {
    throw new Error("useTimeTracker must be used within TimeTrackerProvider.");
  }
  return ctx;
}
