import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PageLoadingFallback } from "@/components/feedback/PageLoadingFallback";
import { GlobalSearch } from "@/components/search/GlobalSearch";

/**
 * Structural shell for the /dashboard route tree: desktop Sidebar +
 * Sheet-based MobileSidebar, sticky Navbar, and the main content area
 * nested routes render into.
 */
export default function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  // Tracks whether the initial mount's "navigation" has already been
  // skipped — moving focus to <main> on the very first paint (before the
  // user has done anything) would be surprising, not helpful, so this
  // effect only fires on a genuine SUBSEQUENT route change.
  const isInitialRender = useRef(true);

  // Phase 3 — Accessibility Hardening (SDD §21 "Focus management on
  // navigation"): a client-side route change swaps the page's content
  // without a full document navigation, so a screen reader/keyboard user
  // gets no automatic cue that anything changed — focus is left wherever
  // it happened to be on the OLD page (often a now-gone element). Moving
  // focus to the new page's main landmark on every `/dashboard/*` route
  // change (not on the very first load) gives both a predictable focus
  // target and an implicit "new content" announcement, without requiring
  // every single page to manage this itself.
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar />
      <MobileSidebar />
      {/* Phase 5.12 — Global Investigation Search. Mounted once here (not
          per-page) so the Ctrl/Cmd+K palette is available from every
          /dashboard/* route, matching how Sidebar/Navbar are themselves
          shell-level, not page-level. */}
      <GlobalSearch />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Navbar />
        {/* `tabIndex={-1}` makes this a valid *programmatic* focus target
            (via `mainRef.current.focus()` above) without inserting it into
            the regular Tab order — a sighted mouse/keyboard user tabbing
            through the page never lands here, only a route change moves
            focus to it. `outline-none` removes the default focus ring for
            this specific, programmatic focus target (a screen reader still
            gets the focus event and announces the landmark) — this does
            not touch any other element's focus-visible styling. */}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 outline-none lg:p-6"
        >
          <Suspense fallback={<PageLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
