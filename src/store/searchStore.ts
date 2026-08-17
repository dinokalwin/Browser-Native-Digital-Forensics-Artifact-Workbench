import * as React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { useEvidenceStore } from "@/store/evidenceStore";
import { useNotesStore, useEnsureCaseNotesLoaded } from "@/store/notesStore";
import { useBookmarksStore, useEnsureCaseBookmarksLoaded } from "@/store/bookmarksStore";
import { useCaseStore, useHydrateCaseStore } from "@/store/caseStore";
import {
  buildSearchIndex,
  hasSearchIntent,
  search as runSearch,
  DEFAULT_SEARCH_FILTERS,
  type SearchFilters,
  type SearchIndex,
  type SearchResponse,
} from "@/lib/search";
import type { RecentSearchEntry } from "@/lib/search/types";

/**
 * Reactive layer for Global Investigation Search (Phase 5.12) — three
 * things live here:
 *
 *  1. `useSearchStore` — ephemeral UI state (is the command palette open,
 *     the current query/filters) plus the persisted recent-search list.
 *     Small enough, and specific enough to this one feature, that its
 *     `localStorage` read/write lives inline below rather than in its own
 *     `lib/search/*` file — this phase's ticket names exactly six files
 *     for that directory (types/index/tokenizer/indexBuilder/searchEngine/
 *     ranking) and none of them is a persistence module, unlike
 *     `lib/cases/storage.ts`/`lib/export/history.ts` in earlier phases.
 *  2. `useSearchIndex()` — builds/memoizes the `SearchIndex`
 *     (`lib/search/indexBuilder.ts`) from whatever `evidenceStore`/
 *     `notesStore`/`bookmarksStore`/`caseStore` currently hold. Rebuilt
 *     only when one of those sources' reference actually changes — the
 *     "invalidated only when investigation/events/notes/bookmarks/IOC
 *     findings change" contract this phase requires — via a plain
 *     `React.useMemo`, not a second piece of Zustand state (an index full
 *     of live `EvtxEvent` references has no business being duplicated
 *     into a global store on top of `evidenceStore` already holding it).
 *  3. `useSearchResults()` — runs `lib/search/searchEngine.ts#search`
 *     against that index, deferred by one animation frame so the
 *     "Searching…" state actually paints before a large query's
 *     (synchronous) scoring pass runs — this phase's "do not block the
 *     interface" requirement, using `requestAnimationFrame` rather than a
 *     Web Worker (this phase explicitly discourages introducing one
 *     "unless profiling shows the synchronous search actually blocks the
 *     UI" — token-bucket lookups keep each call bounded well under a
 *     frame even at 250k events, see the runtime harness).
 */

const RECENT_SEARCH_STORAGE_KEY = "dfir-workbench:search-history";
const MAX_RECENT_SEARCHES = 10;

function readRecentSearches(): RecentSearchEntry[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearchEntry).slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function writeRecentSearches(entries: RecentSearchEntry[]): void {
  try {
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded, private-browsing restrictions, storage disabled —
    // recent searches are a convenience layer; search itself still works
    // fully without this ever succeeding.
  }
}

function isRecentSearchEntry(value: unknown): value is RecentSearchEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.query === "string" &&
    typeof record.timestamp === "string" &&
    typeof record.filters === "object" &&
    record.filters !== null
  );
}

let recentSearchIdCounter = 0;
function nextRecentSearchId(): string {
  recentSearchIdCounter += 1;
  return `search-${Date.now()}-${recentSearchIdCounter}`;
}

interface SearchState {
  isOpen: boolean;
  query: string;
  filters: SearchFilters;
  recentSearches: RecentSearchEntry[];
  recentSearchesHydrated: boolean;

  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  resetFilters: () => void;
  hydrateRecentSearches: () => void;
  addRecentSearch: (query: string, filters: SearchFilters) => void;
  clearRecentSearches: () => void;
}

export const useSearchStore = create<SearchState>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      query: "",
      filters: DEFAULT_SEARCH_FILTERS,
      recentSearches: [],
      recentSearchesHydrated: false,

      open: () => set({ isOpen: true }, false, "search/open"),
      close: () => set({ isOpen: false }, false, "search/close"),
      toggle: () => set((s) => ({ isOpen: !s.isOpen }), false, "search/toggle"),
      setQuery: (query) => set({ query }, false, "search/setQuery"),
      setFilters: (filters) => set({ filters }, false, "search/setFilters"),
      resetFilters: () => set({ filters: DEFAULT_SEARCH_FILTERS }, false, "search/resetFilters"),

      hydrateRecentSearches: () => {
        if (get().recentSearchesHydrated) return;
        set(
          { recentSearches: readRecentSearches(), recentSearchesHydrated: true },
          false,
          "search/hydrateRecentSearches",
        );
      },

      addRecentSearch: (query, filters) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return;
        const entry: RecentSearchEntry = {
          id: nextRecentSearchId(),
          query: trimmed,
          timestamp: new Date().toISOString(),
          filters,
        };
        // De-duplicate by query text (case-insensitive) — re-running the
        // same search moves it to the top instead of listing it twice.
        const withoutDuplicate = get().recentSearches.filter(
          (existing) => existing.query.toLowerCase() !== trimmed.toLowerCase(),
        );
        const next = [entry, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES);
        writeRecentSearches(next);
        set({ recentSearches: next }, false, "search/addRecentSearch");
      },

      clearRecentSearches: () => {
        writeRecentSearches([]);
        set({ recentSearches: [] }, false, "search/clearRecentSearches");
      },
    }),
    { name: "search-store" },
  ),
);

export function useHydrateRecentSearches(): void {
  const hydrate = useSearchStore((s) => s.hydrateRecentSearches);
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);
}

/**
 * Builds/memoizes the `SearchIndex` for whatever investigation is
 * currently loaded. Every dependency below is a live store reference
 * (not a derived copy), so this only actually rebuilds when one of them
 * changes identity — `evidenceStore.loadFiles` replacing `events`/
 * `iocFindings` on a new parse, `notesStore`/`bookmarksStore` replacing
 * their per-case maps on a write, or `caseStore` replacing `cases` on a
 * save/rename/delete. Merely opening the search palette, typing a query,
 * or changing filters never touches any of these, so it never rebuilds.
 */
export function useSearchIndex(): SearchIndex {
  const uploadedFile = useEvidenceStore((s) => s.uploadedFile);
  const events = useEvidenceStore((s) => s.events);
  const iocFindings = useEvidenceStore((s) => s.iocFindings);

  const caseId = uploadedFile?.name ?? null;
  useEnsureCaseNotesLoaded(caseId);
  useEnsureCaseBookmarksLoaded(caseId);
  useHydrateCaseStore();

  const caseNote = useNotesStore((s) => (caseId ? (s.caseNotes[caseId] ?? null) : null));
  const eventNotes = useNotesStore((s) => (caseId ? s.eventNotes[caseId] : undefined));
  const bookmarks = useBookmarksStore((s) => (caseId ? s.bookmarks[caseId] : undefined));
  const savedCases = useCaseStore((s) => s.cases);

  return React.useMemo(
    () =>
      buildSearchIndex({
        events,
        iocFindings,
        caseNote,
        eventNotes: eventNotes ?? {},
        bookmarks: bookmarks ?? {},
        savedCases,
      }),
    [events, iocFindings, caseNote, eventNotes, bookmarks, savedCases],
  );
}

/**
 * Runs `search()` against `index` for the current `query`/`filters`,
 * deferred by one `requestAnimationFrame` so typing never stalls waiting
 * on a large case's scoring pass, and debounced by a short timer so a
 * fast typist doesn't trigger a search per keystroke. Returns `null`
 * while nothing has run yet or the query has no search intent (ticket's
 * "No query" empty state — callers show that instead of an empty results
 * list in that case, see `hasSearchIntent`).
 */
export function useSearchResults(
  index: SearchIndex,
  query: string,
  filters: SearchFilters,
): { response: SearchResponse | null; isSearching: boolean } {
  const [response, setResponse] = React.useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);

  const hasIntent = hasSearchIntent(query, filters);

  React.useEffect(() => {
    // No search intent — nothing to run. `response`/`isSearching` are
    // masked back to "nothing to show" in this hook's return value below
    // regardless of whatever they were last set to, so there's no state to
    // reset here — which also means this branch never calls `setState`
    // (see the next comment for why that matters).
    if (!hasIntent) return;

    let cancelled = false;

    // `setIsSearching(true)` is deferred into a microtask rather than
    // called directly at the top of this effect: calling `setState`
    // synchronously in an effect body triggers an extra synchronous render
    // pass on every commit (`react-hooks/set-state-in-effect`). Queuing it
    // is imperceptible to the user (sub-millisecond) but keeps every state
    // update in this hook happening from inside a callback, the same as
    // the debounce/rAF-scheduled update below.
    queueMicrotask(() => {
      if (!cancelled) setIsSearching(true);
    });

    // Debounced by a short timer (fast typing shouldn't trigger a search
    // per keystroke) and, once the timer fires, deferred by one more
    // animation frame so the "Searching…" state has actually painted
    // before the (synchronous) scoring pass below runs — both handles are
    // tracked so the cleanup function can cancel whichever one hasn't
    // fired yet if `query`/`filters`/`index` change again first.
    let frameHandle: number | null = null;
    const debounceHandle = window.setTimeout(() => {
      frameHandle = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setResponse(runSearch(index, query, filters));
        setIsSearching(false);
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceHandle);
      if (frameHandle !== null) window.cancelAnimationFrame(frameHandle);
    };
  }, [index, query, filters, hasIntent]);

  return {
    response: hasIntent ? response : null,
    isSearching: hasIntent ? isSearching : false,
  };
}
