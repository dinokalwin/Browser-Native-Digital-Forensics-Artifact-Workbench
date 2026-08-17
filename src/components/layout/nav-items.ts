import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Table2,
  History,
  ShieldCheck,
  Folders,
  Download,
  Search,
  Settings,
} from "lucide-react";

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
  // Phase 5 Item 2 — Configurable Rule Set. This is the "Settings" item
  // Sprint 5.9.1's and Phase 5.11's own comments (below/above) anticipated
  // but didn't yet have anything to build — placed here, between Timeline
  // and MITRE ATT&CK, exactly where Sprint 5.9.1 said it would go.
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
  { label: "MITRE ATT&CK", to: "/dashboard/mitre", icon: ShieldCheck },
  // Phase 5.10 — Case Management.
  { label: "Case Library", to: "/dashboard/cases", icon: Folders },
  // Phase 5.11 — Export Center. Ticket: "Place near Case Library /
  // Settings." — placed directly after Case Library, so the two
  // data-management-adjacent pages sit next to each other.
  { label: "Export Center", to: "/dashboard/export", icon: Download },
  // Phase 5.12 — Global Investigation Search. The Ctrl/Cmd+K palette and
  // the Navbar search button (both covering every /dashboard/* route
  // already) are the primary ways into this feature; this nav item exists
  // for discoverability and for opening the full, non-modal page directly
  // (e.g. to keep a broad search's results on screen alongside other work,
  // which a modal palette isn't suited for) — same reasoning as Case
  // Library/Export Center each getting their own nav item despite also
  // being reachable from other entry points.
  { label: "Search", to: "/dashboard/search", icon: Search },
];
