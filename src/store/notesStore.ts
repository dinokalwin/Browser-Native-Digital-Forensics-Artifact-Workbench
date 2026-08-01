import * as React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import {
  loadCaseNote,
  saveCaseNote,
  removeCaseNote,
  loadEventNotes,
  saveEventNote,
  removeEventNote,
  type CaseNote,
  type EventNote,
  type EventNoteMap,
} from "@/lib/notes";

/**
 * Reactive layer over `lib/notes.ts` (Sprint 4.1). `localStorage` is the
 * real source of truth — every mutation writes through it immediately —
 * but components read from this in-memory mirror instead of calling
 * `lib/notes.ts` directly, for two reasons:
 *
 *  1. Multiple, unrelated parts of the tree need the same data (a per-row
 *     note indicator in the Evidence Table, the Event Details Drawer, a
 *     dashboard-wide Case Notes panel) without prop-drilling — the same
 *     reason evidenceStore/filterStore/uiStore exist as Zustand stores in
 *     this codebase already.
 *  2. Fine-grained selectors (`useHasEventNote` below) mean editing one
 *     event's note only re-renders the one row subscribed to that event's
 *     boolean, not the whole table — reading `localStorage` directly on
 *     every render would work too, but wouldn't notify React that
 *     anything changed when a *different* component wrote a note.
 *
 * A case's notes are loaded into this store lazily, on first use, via
 * `useEnsureCaseNotesLoaded` — there's no "current case" concept at
 * store-creation time, so nothing is preloaded up front.
 */

interface NotesState {
  caseNotes: Record<string, CaseNote>;
  eventNotes: Record<string, EventNoteMap>;
  loadedCases: Record<string, true>;

  hydrateCase: (caseId: string) => void;
  setCaseNote: (caseId: string, text: string) => void;
  clearCaseNote: (caseId: string) => void;
  setEventNote: (caseId: string, eventId: string, text: string) => void;
  deleteEventNote: (caseId: string, eventId: string) => void;
}

export const useNotesStore = create<NotesState>()(
  devtools(
    (set, get) => ({
      caseNotes: {},
      eventNotes: {},
      loadedCases: {},

      hydrateCase: (caseId) => {
        if (!caseId || get().loadedCases[caseId]) return;
        const caseNote = loadCaseNote(caseId);
        const events = loadEventNotes(caseId);
        set(
          (s) => ({
            caseNotes: caseNote ? { ...s.caseNotes, [caseId]: caseNote } : s.caseNotes,
            eventNotes: { ...s.eventNotes, [caseId]: events },
            loadedCases: { ...s.loadedCases, [caseId]: true },
          }),
          false,
          "notes/hydrateCase",
        );
      },

      setCaseNote: (caseId, text) => {
        const note = saveCaseNote(caseId, text);
        set(
          (s) => ({ caseNotes: { ...s.caseNotes, [caseId]: note } }),
          false,
          "notes/setCaseNote",
        );
      },

      clearCaseNote: (caseId) => {
        removeCaseNote(caseId);
        set(
          (s) => {
            const rest = { ...s.caseNotes };
            delete rest[caseId];
            return { caseNotes: rest };
          },
          false,
          "notes/clearCaseNote",
        );
      },

      setEventNote: (caseId, eventId, text) => {
        const note = saveEventNote(caseId, eventId, text);
        set(
          (s) => ({
            eventNotes: {
              ...s.eventNotes,
              [caseId]: { ...(s.eventNotes[caseId] ?? {}), [eventId]: note },
            },
          }),
          false,
          "notes/setEventNote",
        );
      },

      deleteEventNote: (caseId, eventId) => {
        removeEventNote(caseId, eventId);
        set(
          (s) => {
            const caseMap = { ...(s.eventNotes[caseId] ?? {}) };
            delete caseMap[eventId];
            return { eventNotes: { ...s.eventNotes, [caseId]: caseMap } };
          },
          false,
          "notes/deleteEventNote",
        );
      },
    }),
    { name: "notes-store" },
  ),
);

/**
 * Ensures `caseId`'s notes have been loaded from `localStorage` into the
 * store. Cheap and idempotent (guarded by `loadedCases` above), so it's
 * safe to call from every component that reads notes for a case — the
 * Case Notes panel, the Event Details Drawer, and every row's note
 * indicator in the Evidence Table — rather than relying on a single
 * "owner" component to have hydrated it first, since notes-bearing UI can
 * be reached via more than one route (e.g. navigating straight to
 * /dashboard/evidence without visiting /dashboard first).
 */
export function useEnsureCaseNotesLoaded(caseId: string | null): void {
  const hydrateCase = useNotesStore((s) => s.hydrateCase);
  React.useEffect(() => {
    if (caseId) hydrateCase(caseId);
  }, [caseId, hydrateCase]);
}

export function useCaseNote(caseId: string | null): CaseNote | null {
  return useNotesStore((s) => (caseId ? (s.caseNotes[caseId] ?? null) : null));
}

export function useEventNote(caseId: string | null, eventId: string | null): EventNote | null {
  return useNotesStore((s) => (caseId && eventId ? (s.eventNotes[caseId]?.[eventId] ?? null) : null));
}

export function useHasEventNote(caseId: string | null, eventId: string): boolean {
  return useNotesStore((s) => Boolean(caseId && s.eventNotes[caseId]?.[eventId]));
}
