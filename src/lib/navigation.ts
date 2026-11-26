import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  Dumbbell,
  Goal,
  GraduationCap,
  Languages,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  phase: string;
  enabled: boolean;
};

export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    phase: "Foundation",
    enabled: true,
  },
  {
    title: "Time Tracker",
    href: "/time-tracker",
    icon: Clock3,
    phase: "Phase 2",
    enabled: true,
  },
  {
    title: "English Communication",
    href: "/english-communication",
    icon: Languages,
    phase: "Phase 10",
    enabled: true,
  },
  {
    title: "DSA Tracker",
    href: "/dsa-tracker",
    icon: ChartNoAxesCombined,
    phase: "Phase 3",
    enabled: true,
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: BriefcaseBusiness,
    phase: "Phase 4",
    enabled: true,
  },
  {
    title: "Learning",
    href: "/learning-journal",
    icon: GraduationCap,
    phase: "Phase 5",
    enabled: true,
  },
  {
    title: "Habits",
    href: "/habits",
    icon: Dumbbell,
    phase: "Phase 6",
    enabled: true,
  },
  {
    title: "Goals",
    href: "/goals",
    icon: Goal,
    phase: "Phase 7",
    enabled: true,
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    phase: "Phase 9",
    enabled: true,
  },
];
