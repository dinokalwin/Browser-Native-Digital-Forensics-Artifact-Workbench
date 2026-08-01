import * as React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { loadBookmarks, addBookmark, removeBookmark, type BookmarkMap } from "@/lib/bookmarks";

/**
 * Reactive layer over `lib/bookmarks.ts` (Sprint 4.2) — same shape and
 * same reasoning as `store/notesStore.ts` (Sprint 4.1): `localStorage` is
 * the source of truth, this store is an in-memory mirror components
 * subscribe to, and a case's bookmarks are loaded in lazily on first use
 * via `useEnsureCaseBookmarksLoaded` rather than preloaded up front (there
 * is no "current case" at store-creation time).
 *
 * Selectors are intentionally fine-grained (`useIsBookmarked` returns a
 * single boolean for one event) so that bookmarking one event only
 * re-renders the one row/button subscribed to *that* event's boolean —
 * every other row's selector returns the same reference/value as before
 * and Zustand skips re-rendering it.
 */

interface BookmarksState {
  bookmarks: Record<string, BookmarkMap>; // caseId -> eventId -> true
  loadedCases: Record<string, true>;

  hydrateCase: (caseId: string) => void;
  toggleBookmark: (caseId: string, eventId: string) => void;
}

export const useBookmarksStore = create<BookmarksState>()(
  devtools(
    (set, get) => ({
      bookmarks: {},
      loadedCases: {},

      hydrateCase: (caseId) => {
        if (!caseId || get().loadedCases[caseId]) return;
        const map = loadBookmarks(caseId);
        set(
          (s) => ({
            bookmarks: { ...s.bookmarks, [caseId]: map },
            loadedCases: { ...s.loadedCases, [caseId]: true },
          }),
          false,
          "bookmarks/hydrateCase",
        );
      },

      toggleBookmark: (caseId, eventId) => {
        const isBookmarked = Boolean(get().bookmarks[caseId]?.[eventId]);
        if (isBookmarked) {
          removeBookmark(caseId, eventId);
        } else {
          addBookmark(caseId, eventId);
        }
        set(
          (s) => {
            const caseMap = { ...(s.bookmarks[caseId] ?? {}) };
            if (isBookmarked) {
              delete caseMap[eventId];
            } else {
              caseMap[eventId] = true;
            }
            return { bookmarks: { ...s.bookmarks, [caseId]: caseMap } };
          },
          false,
          "bookmarks/toggleBookmark",
        );
      },
    }),
    { name: "bookmarks-store" },
  ),
);

/**
 * Ensures `caseId`'s bookmarks have been loaded from `localStorage` into
 * the store. Cheap and idempotent (guarded by `loadedCases`), safe to call
 * from every bookmark-aware component regardless of which route got it
 * there first — same reasoning as `notesStore.ts`'s
 * `useEnsureCaseNotesLoaded`.
 */
export function useEnsureCaseBookmarksLoaded(caseId: string | null): void {
  const hydrateCase = useBookmarksStore((s) => s.hydrateCase);
  React.useEffect(() => {
    if (caseId) hydrateCase(caseId);
  }, [caseId, hydrateCase]);
}

export function useIsBookmarked(caseId: string | null, eventId: string): boolean {
  return useBookmarksStore((s) => Boolean(caseId && s.bookmarks[caseId]?.[eventId]));
}

/** The full bookmark map for one case — for count displays and the "Bookmarked Only" filter. */
export function useBookmarkMap(caseId: string | null): BookmarkMap {
  return useBookmarksStore((s) => (caseId ? (s.bookmarks[caseId] ?? EMPTY_MAP) : EMPTY_MAP));
}

// Stable empty-object reference so `useBookmarkMap` never returns a new
// object identity for "no bookmarks yet" — an inline `{}` fallback would
// be a fresh reference on every call, defeating Zustand's equality check
// and re-rendering every subscriber on every unrelated store update.
const EMPTY_MAP: BookmarkMap = {};

export function useBookmarkCount(caseId: string | null): number {
  return useBookmarksStore((s) => (caseId ? Object.keys(s.bookmarks[caseId] ?? {}).length : 0));
}
