"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { loadTimeTrackerState } from "@/features/time-tracker/time-tracker-storage";

export default function AuditPage() {
  const { user, loading } = useAuth();
  const [status, setStatus] = useState("Waiting for authentication...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function performAudit() {
      if (loading) return;
      
      if (!user) {
        setStatus("Please log in to your account first.");
        return;
      }

      try {
        setStatus("Fetching Time Tracker data from Firestore...");
        const state = await loadTimeTrackerState(user.uid);
        
        setStatus("Data fetched. Saving to local filesystem...");
        const response = await fetch("/api/audit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
            state: state,
          }),
        });

        const result = await response.json();
        if (result.success) {
          setStatus("Success! Audit data has been saved locally to audit_data.json.");
        } else {
          throw new Error(result.error);
        }
      } catch (err: unknown) {
        console.error("Audit extraction failed:", err);
        setError((err as Error).message);
        setStatus("Failed to extract data.");
      }
    }

    performAudit();
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-card text-center">
        <h1 className="text-xl font-semibold text-text-primary mb-4">Time Tracker Audit</h1>
        <p className="text-text-secondary text-sm mb-6">{status}</p>
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
