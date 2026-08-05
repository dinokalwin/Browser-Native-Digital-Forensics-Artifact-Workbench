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

/**
 * Route map:
 *   /                   -> LandingPage (upload entry point)
 *   /dashboard          -> AppShell > DashboardPage (overview)
 *   /dashboard/evidence -> AppShell > EvidenceViewerPage
 *   /dashboard/timeline -> AppShell > TimelinePage
 *   /dashboard/mitre    -> AppShell > MitreAttackPage (Sprint 5.9.1)
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
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
