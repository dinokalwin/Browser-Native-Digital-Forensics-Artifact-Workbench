import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AppShell from "@/layouts/AppShell";
import LandingPage from "@/pages/LandingPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Lazy-loaded: these pull in TanStack Table, the panel components, and
// (transitively, via evidenceStore's dynamic import) the EVTX parser's
// dependency chain — none of which the landing page needs on first load.
// AppShell wraps <Outlet /> in a <Suspense> boundary that covers all
// three. LandingPage and NotFoundPage stay static imports: Landing is
// the entry route (lazy-loading it would just add a waterfall before
// anything renders), and NotFoundPage sits outside AppShell's Suspense
// boundary with no boundary of its own to catch a lazy import.
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const EvidenceViewerPage = lazy(() => import("@/pages/EvidenceViewerPage"));
const TimelinePage = lazy(() => import("@/pages/TimelinePage"));
// Sprint 5.9.1 — lazy-loaded the same way as every other /dashboard
// sub-route: recharts, the MITRE lib modules, and this page's own
// components only ship once an investigator actually navigates here.
const MitreAttackPage = lazy(() => import("@/pages/MitreAttackPage"));
// Phase 5.10 — same lazy-route convention: the Case Library's own
// components (and, unlike every route above, `evidenceStore` is NOT a
// prerequisite to view this one) only ship once an analyst navigates here.
const CasesPage = lazy(() => import("@/pages/CasesPage"));
// Phase 5.11 — same lazy-route convention again: jsPDF/JSZip and the
// Export Center's own components only ship once an analyst actually
// navigates to /dashboard/export (JSZip itself is a second, inner lazy
// import inside `lib/export/zip.ts`, fetched only on an actual ZIP
// export click, not merely on visiting this page).
const ExportPage = lazy(() => import("@/pages/ExportPage"));
// Phase 5.12 — same lazy-route convention: `lib/search`'s index-building/
// ranking code and this page's own components only ship once an analyst
// navigates to /dashboard/search. The Ctrl/Cmd+K palette
// (`GlobalSearch.tsx`/`SearchCommand.tsx`) is mounted from AppShell.tsx
// instead, but is itself a separate `React.lazy` boundary that only fetches
// once actually opened — see that file's own comment — so visiting this
// page and opening the palette are two independent ways to reach the same
// underlying `lib/search`/`searchStore.ts` code, neither one forcing the
// other to load early.
const SearchPage = lazy(() => import("@/pages/SearchPage"));
// Phase 5 Item 2 — Configurable Rule Set. Same lazy-route convention: the
// Settings page's own components only ship once an analyst navigates to
// /dashboard/settings, exactly like every other /dashboard sub-route above.
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

/**
 * Route map:
 *   /                   -> LandingPage (upload entry point)
 *   /dashboard          -> AppShell > DashboardPage (overview)
 *   /dashboard/evidence -> AppShell > EvidenceViewerPage
 *   /dashboard/timeline -> AppShell > TimelinePage
 *   /dashboard/mitre    -> AppShell > MitreAttackPage (Sprint 5.9.1)
 *   /dashboard/cases    -> AppShell > CasesPage (Phase 5.10)
 *   /dashboard/export   -> AppShell > ExportPage (Phase 5.11)
 *   /dashboard/search   -> AppShell > SearchPage (Phase 5.12)
 *   /dashboard/settings -> AppShell > SettingsPage (Phase 5 Item 2)
 *   *                   -> NotFoundPage
 *
 * All case data lives in Zustand (not route params/loaders), so
 * navigating between dashboard sub-routes never re-fetches or re-parses
 * anything — it just changes which panel is on screen.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/dashboard",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "evidence", element: <EvidenceViewerPage /> },
      { path: "timeline", element: <TimelinePage /> },
      { path: "mitre", element: <MitreAttackPage /> },
      { path: "cases", element: <CasesPage /> },
      { path: "export", element: <ExportPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
