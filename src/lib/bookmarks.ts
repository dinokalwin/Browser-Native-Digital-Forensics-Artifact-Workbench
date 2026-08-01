/**
 * Event Bookmarks — persistence utility (Sprint 4.2).
 *
 * Same role and shape as `lib/notes.ts` (Sprint 4.1): pure, framework-free
 * localStorage I/O, namespaced per case (uploaded file name), defensive
 * about a missing/disabled `localStorage` (never throws — a failed
 * read/write just means bookmarks don't persist that session, not a
 * crash). `store/bookmarksStore.ts` is the only thing that imports this
 * module; UI components never touch it directly.
 */

const STORAGE_PREFIX = "dfir-workbench:bookmarks";

/** eventId (EvtxEvent.id) -> true, for a single case. Absence = not bookmarked. */
export type BookmarkMap = Record<string, true>;

function bookmarksKey(caseId: string): string {
  return `${STORAGE_PREFIX}:${caseId}`;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded, private-browsing restrictions, storage disabled —
    // bookmarks are a convenience layer, not the investigation itself.
  }
}

/** Loads every bookmarked eventId for `caseId`. Never returns `null` — an empty map if none exist. */
export function loadBookmarks(caseId: string): BookmarkMap {
  if (!caseId) return {};
  return readJSON<BookmarkMap>(bookmarksKey(caseId)) ?? {};
}

/** Bookmarks a single event within `caseId`. */
export function addBookmark(caseId: string, eventId: string): void {
  const all = loadBookmarks(caseId);
  if (all[eventId]) return;
  writeJSON(bookmarksKey(caseId), { ...all, [eventId]: true });
}

/** Removes a single event's bookmark within `caseId`, if any. */
export function removeBookmark(caseId: string, eventId: string): void {
  const all = loadBookmarks(caseId);
  if (!all[eventId]) return;
  const rest = { ...all };
  delete rest[eventId];
  writeJSON(bookmarksKey(caseId), rest);
}
