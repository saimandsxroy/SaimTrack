export const timeCategories = [
  "DSA",
  "Development",
  "Learning",
  "Client Work",
  "Interview Preparation",
  "College",
  "Communication",
  "Other",
] as const;

export type TimeCategory = string;

export type TimeEntry = {
  id: string;
  title: string;
  category: TimeCategory;
  startTime: string;
  endTime: string;
  duration: number;
  date: string;
  notes?: string;
};

export type ActiveTimer = {
  id: string;
  title: string;
  category: TimeCategory;
  startTime: string;
  runningSince: string;
  accumulatedMs: number;
  status: "running" | "paused";
};

export type TimeTrackerPeriod = "today" | "week" | "month" | "year" | "lifetime";
