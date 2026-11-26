"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { RequireAuth } from "@/features/auth/auth-guards";
import { TimeTrackerProvider } from "@/features/time-tracker/time-tracker-context";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <TimeTrackerProvider>
        <AppShell>{children}</AppShell>
      </TimeTrackerProvider>
    </RequireAuth>
  );
}
