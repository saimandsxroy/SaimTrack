"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flame, Sparkles, X } from "lucide-react";

type StreakCelebrationProps = {
  visible: boolean;
  streakCount: number;
  goalMinutes: number;
  animationsEnabled: boolean;
  onDismiss: () => void;
};

export function StreakCelebration({
  visible,
  streakCount,
  goalMinutes,
  animationsEnabled,
  onDismiss,
}: StreakCelebrationProps) {
  const shouldReduceMotion = useReducedMotion();
  const animate = animationsEnabled && !shouldReduceMotion;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={animate ? { opacity: 0, y: -12, scale: 0.98 } : { opacity: 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={animate ? { opacity: 0, y: -10, scale: 0.98 } : { opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative overflow-hidden rounded-xl border border-accent/40 bg-surface p-5 shadow-card"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div
                animate={
                  animate
                    ? {
                        scale: [1, 1.15, 1],
                        rotate: [0, -6, 6, 0],
                      }
                    : undefined
                }
                transition={{ duration: 0.9, repeat: 1 }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-subtle border border-accent/30 text-accent"
              >
                <Flame className="h-6 w-6 fill-accent/30" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-text-primary">
                    Daily English Goal Completed
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-accent-subtle text-accent-text">
                    <Sparkles className="h-3 w-3" /> {streakCount}-Day Streak
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-text-secondary">
                  {goalMinutes} minutes of focused English practice logged for today.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss goal completion notice"
              className="self-start sm:self-center rounded-md p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface-raised transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
            <motion.div
              initial={animate ? { width: "40%" } : { width: "100%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-accent"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
