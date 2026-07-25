import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Table2, History } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Only the index route of /dashboard should match exactly. */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Evidence Viewer", to: "/dashboard/evidence", icon: Table2 },
  { label: "Timeline", to: "/dashboard/timeline", icon: History },
];
