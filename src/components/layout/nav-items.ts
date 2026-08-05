import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Table2, History, ShieldCheck } from "lucide-react";

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
  // Sprint 5.9.1 — no "Settings" nav item exists in this app, so this is
  // appended as the last item per that sprint's own fallback instruction
  // ("between Timeline and Settings ... or last item if Settings does not
  // exist").
  { label: "MITRE ATT&CK", to: "/dashboard/mitre", icon: ShieldCheck },
];
