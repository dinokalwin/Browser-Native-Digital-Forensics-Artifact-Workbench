import * as React from "react";

import { useSearchStore } from "@/store/searchStore";

// Lazy-loaded, not a static import: `SearchCommand` (and everything it
// pulls in — `lib/search`'s index builder/ranking/tokenizer,
// `searchStore.ts`, `SearchFilters`/`SearchResults`/every other search
// component) only ships once an analyst actually opens the palette, same
// as `DashboardPage.tsx`'s own `AnalyticsPanel` lazy-import. Since
// `GlobalSearch` itself is mounted unconditionally from `AppShell.tsx` —
// i.e. on every `/dashboard/*` visit — keeping this one `React.lazy` call
// here (rather than on `GlobalSearch` itself) is what actually keeps
// `lib/search` out of the initial `/dashboard` bundle: this component only
// even attempts the import once `isOpen` first flips true below.
const SearchCommand = React.lazy(() =>
  import("@/components/search/SearchCommand").then((m) => ({ default: m.SearchCommand })),
);

/**
 * Mount point for Global Investigation Search (ticket "6. SEARCH UI —
 * header search button + Ctrl/Cmd+K") — rendered once from `AppShell.tsx`
 * so the palette (and its keyboard shortcut) is available from every
 * `/dashboard/*` route, not just a page that happens to import it.
 * `Navbar.tsx`'s search button opens the same store state this listener
 * toggles, so both entry points always agree on what "open" means.
 *
 * The listener only ever intercepts the exact Ctrl/Cmd+K combination
 * (`e.preventDefault()` there stops the browser's own address-bar/search
 * shortcut, which is the whole point of binding this combo) — every other
 * keystroke, including Ctrl/Cmd plus any other letter, passes through
 * completely untouched, so this can't interfere with any other browser or
 * OS shortcut.
 *
 * `SearchCommand` itself (and its `Suspense` boundary) is only rendered
 * once `isOpen` has been true at least once (`hasOpenedOnce`) — the very
 * first Ctrl/Cmd+K press or Navbar click pays a one-time chunk fetch
 * (typically imperceptible; there's no heavy third-party dependency in
 * `lib/search`, unlike the PDF/ZIP export chunks), and every subsequent
 * open/close is instant since the module stays cached from then on.
 */
export function GlobalSearch() {
  const isOpen = useSearchStore((s) => s.isOpen);
  const toggle = useSearchStore((s) => s.toggle);
  const [hasOpenedOnce, setHasOpenedOnce] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isModifierK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isModifierK) return;
      e.preventDefault();
      toggle();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // Render-time "latch" (React's documented "adjusting state when a prop
  // changes" pattern, not a `useEffect`) — the same render-time-adjustment
  // convention already used throughout this project (`MitreAttackPage.tsx`'s
  // `focusTechniqueId`, `DashboardPage.tsx`'s `focusEventId`). Once
  // `isOpen` is ever true, `hasOpenedOnce` flips permanently on that same
  // render, so the lazy `SearchCommand` chunk starts fetching the instant
  // it's needed rather than one extra render later.
  if (isOpen && !hasOpenedOnce) {
    setHasOpenedOnce(true);
  }

  if (!hasOpenedOnce) return null;

  return (
    <React.Suspense fallback={null}>
      <SearchCommand />
    </React.Suspense>
  );
}
