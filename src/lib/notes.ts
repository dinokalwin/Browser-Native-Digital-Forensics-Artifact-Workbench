/**
 * Investigator Notes — persistence utility (Sprint 4.1).
 *
 * Pure, framework-free localStorage I/O: no React, no Zustand, no DOM
 * beyond `window.localStorage`. Same role in this feature as
 * `lib/statistics.ts` / `lib/eventFilters.ts` play for their features —
 * the "business logic" layer that `store/notesStore.ts` (reactive state
 * for components) wraps and that UI components never touch directly.
 *
 * Notes are namespaced per case (keyed by the uploaded file's name, via
 * `evidenceStore.uploadedFile.name`) so switching case files never mixes
 * one investigation's notes into another's, and are stored as plain JSON
 * under a small number of `localStorage` keys — one for the case-wide
 * note, one holding a map of all per-event notes for that case.
 *
 * Every function here is defensive: a missing/disabled/quota-exceeded
 * `localStorage` (private browsing, locked-down environments, etc.) must
 * degrade to "notes just don't persist this session" rather than crash an
 * otherwise-working investigation — matching this codebase's existing
 * resilience conventions (parser, statistics, filters all follow the same
 * "never throw on bad/missing data" rule).
 */

const STORAGE_PREFIX = "dfir-workbench:notes";

export interface CaseNote {
  text: string;
  /** ISO 8601 */
  updatedAt: string;
}

export interface EventNote {
  text: string;
  /** ISO 8601 */
  updatedAt: string;
}

/** eventId (EvtxEvent.id) -> note, for a single case. */
export type EventNoteMap = Record<string, EventNote>;

function caseNoteKey(caseId: string): string {
  return `${STORAGE_PREFIX}:case:${caseId}`;
}

function eventNotesKey(caseId: string): string {
  return `${STORAGE_PREFIX}:events:${caseId}`;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Malformed JSON from a previous version, or localStorage unavailable
    // entirely — either way, treat it as "nothing saved" rather than throw.
    return null;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, private-browsing restrictions, storage disabled —
    // notes are a convenience layer on top of the investigation, not the
    // investigation itself, so a failed write must never throw.
    return false;
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // See writeJSON — best effort only.
  }
}

/** Loads the case-wide note for `caseId`, or `null` if none is saved. */
export function loadCaseNote(caseId: string): CaseNote | null {
  if (!caseId) return null;
  return readJSON<CaseNote>(caseNoteKey(caseId));
}

/** Saves (overwrites) the case-wide note for `caseId`, stamping `updatedAt` now. */
export function saveCaseNote(caseId: string, text: string): CaseNote {
  const note: CaseNote = { text, updatedAt: new Date().toISOString() };
  writeJSON(caseNoteKey(caseId), note);
  return note;
}

/** Deletes the case-wide note for `caseId`, if any. */
export function removeCaseNote(caseId: string): void {
  removeKey(caseNoteKey(caseId));
}

/** Loads every per-event note saved for `caseId`. Never returns `null` — an empty map if none exist. */
export function loadEventNotes(caseId: string): EventNoteMap {
  if (!caseId) return {};
  return readJSON<EventNoteMap>(eventNotesKey(caseId)) ?? {};
}

/** Saves (overwrites) the note for a single event within `caseId`, stamping `updatedAt` now. */
export function saveEventNote(caseId: string, eventId: string, text: string): EventNote {
  const all = loadEventNotes(caseId);
  const note: EventNote = { text, updatedAt: new Date().toISOString() };
  writeJSON(eventNotesKey(caseId), { ...all, [eventId]: note });
  return note;
}

/** Deletes the note for a single event within `caseId`, if any. */
export function removeEventNote(caseId: string, eventId: string): void {
  const all = loadEventNotes(caseId);
  if (!(eventId in all)) return;
  const rest = { ...all };
  delete rest[eventId];
  writeJSON(eventNotesKey(caseId), rest);
}
