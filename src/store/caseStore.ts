import * as React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { useEvidenceStore } from "@/store/evidenceStore";
import { useNotesStore, useEnsureCaseNotesLoaded } from "@/store/notesStore";
import { useEnsureCaseBookmarksLoaded, useBookmarkCount } from "@/store/bookmarksStore";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import { deleteCase, getCase, loadCases, markCaseOpened, renameCase, upsertCase } from "@/lib/cases/storage";
import type { CaseMetadata, CaseUpsertInput } from "@/lib/cases/types";

/**
 * Reactive layer over `lib/cases/storage.ts` (Phase 5.10) — same role and
 * shape as `store/notesStore.ts`/`store/bookmarksStore.ts`: `localStorage`
 * (via `lib/cases/storage.ts`) is the real source of truth, this store is
 * an in-memory mirror components subscribe to so the Cases page, Recent
 * Cases, and the Dashboard's auto-save hook (`useAutoSaveCaseOnReady`
 * below) all see the same list without prop-drilling or re-reading
 * `localStorage` on every render.
 *
 * Unlike notes/bookmarks, there's exactly one thing to hydrate here (the
 * whole case index, not one case at a time), so this store hydrates once,
 * lazily, on first use via `useHydrateCaseStore` — the same
 * "load on first use, not up front" precedent those two stores already
 * established.
 */

interface CaseState {
  cases: CaseMetadata[];
  hydrated: boolean;

  hydrate: () => void;
  upsertFromInvestigation: (input: CaseUpsertInput) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  markOpened: (id: string) => void;
}

export const useCaseStore = create<CaseState>()(
  devtools(
    (set, get) => ({
      cases: [],
      hydrated: false,

      hydrate: () => {
        if (get().hydrated) return;
        set({ cases: loadCases(), hydrated: true }, false, "cases/hydrate");
      },

      upsertFromInvestigation: (input) => {
        const record = upsertCase(input);
        set(
          (s) => {
            const others = s.cases.filter((c) => c.id !== record.id);
            return { cases: [...others, record] };
          },
          false,
          "cases/upsertFromInvestigation",
        );
      },

      rename: (id, name) => {
        const record = renameCase(id, name);
        if (!record) return;
        set(
          (s) => ({ cases: s.cases.map((c) => (c.id === id ? record : c)) }),
          false,
          "cases/rename",
        );
      },

      remove: (id) => {
        deleteCase(id);
        set((s) => ({ cases: s.cases.filter((c) => c.id !== id) }), false, "cases/remove");
      },

      markOpened: (id) => {
        const record = markCaseOpened(id);
        if (!record) return;
        set(
          (s) => ({ cases: s.cases.map((c) => (c.id === id ? record : c)) }),
          false,
          "cases/markOpened",
        );
      },
    }),
    { name: "case-store" },
  ),
);

/**
 * Ensures the case index has been loaded from `localStorage` into the
 * store. Cheap and idempotent (guarded by `hydrated`), safe to call from
 * every case-aware component (`CasesPage`, `RecentCases`,
 * `useAutoSaveCaseOnReady` below) regardless of which one mounts first —
 * same reasoning as `notesStore.ts`'s `useEnsureCaseNotesLoaded`.
 */
export function useHydrateCaseStore(): void {
  const hydrate = useCaseStore((s) => s.hydrate);
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);
}

/** Looks up one case's metadata directly from the store's live list —
 * `undefined` if it isn't (or isn't yet) loaded. */
export function useCaseMetadata(id: string | null): CaseMetadata | undefined {
  return useCaseStore((s) => (id ? s.cases.find((c) => c.id === id) : undefined));
}

/**
 * Dashboard Integration (Phase 5.10) — "When an investigation finishes
 * parsing, automatically save/update its metadata." Reads everything
 * needed to build a `CaseUpsertInput` from `evidenceStore` (the
 * currently-loaded investigation) plus the notes/bookmarks stores, and
 * calls `upsertFromInvestigation` exactly once per parse-completion —
 * not on every render while `status` stays `"ready"`, and not
 * continuously as notes/bookmarks change mid-session (this hook fires on
 * the parsing-finish *event*, matching the ticket's own wording, rather
 * than keeping metadata continuously in sync).
 *
 * `lastSavedCaseIdRef` is reset to `null` whenever `status` leaves
 * `"ready"`, so re-uploading the *same* filename in the same session
 * (ready -> parsing -> analyzing -> ready again) still triggers a fresh
 * save on the second "ready" — a plain `caseId` guard alone would
 * otherwise treat that second completion as already-saved, since the id
 * string is identical both times.
 *
 * No new pass over `events`/`iocFindings` beyond what `evidenceStore`
 * already computed once during `loadFiles` — `aggregateMitreFindings` is
 * the same cheap, `<=13`-technique-bounded pure function every other
 * MITRE-aware page in this app already calls a second/third time from its
 * own `iocFindings`, not a re-detection.
 */
export function useAutoSaveCaseOnReady(): void {
  const status = useEvidenceStore((s) => s.status);
  const uploadedFile = useEvidenceStore((s) => s.uploadedFile);
  const uploadedFiles = useEvidenceStore((s) => s.uploadedFiles);
  const eventCount = useEvidenceStore((s) => s.events.length);
  const iocFindings = useEvidenceStore((s) => s.iocFindings);
  const investigationSummary = useEvidenceStore((s) => s.investigationSummary);

  const caseId = uploadedFile?.name ?? null;

  useEnsureCaseNotesLoaded(caseId);
  useEnsureCaseBookmarksLoaded(caseId);
  const caseNote = useNotesStore((s) => (caseId ? s.caseNotes[caseId] : undefined));
  const eventNotes = useNotesStore((s) => (caseId ? s.eventNotes[caseId] : undefined));
  const bookmarksCount = useBookmarkCount(caseId);

  const upsertFromInvestigation = useCaseStore((s) => s.upsertFromInvestigation);

  const lastSavedCaseIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (status !== "ready") {
      lastSavedCaseIdRef.current = null;
      return;
    }
    if (!caseId || lastSavedCaseIdRef.current === caseId) return;
    lastSavedCaseIdRef.current = caseId;

    const mitreAggregation = aggregateMitreFindings(iocFindings);
    const notesCount = (caseNote ? 1 : 0) + Object.keys(eventNotes ?? {}).length;
    const fileSize = uploadedFiles.reduce((sum, file) => sum + file.sizeBytes, 0);

    upsertFromInvestigation({
      id: caseId,
      eventCount,
      findingCount: iocFindings.length,
      mitreTechniqueCount: mitreAggregation.techniques.length,
      threatScore: investigationSummary?.riskScore.score ?? 0,
      threatLevel: investigationSummary?.riskScore.level ?? "low",
      sourceFiles: uploadedFiles.map((file) => file.name),
      fileSize,
      notesCount,
      bookmarksCount,
    });
  }, [
    status,
    caseId,
    eventCount,
    iocFindings,
    investigationSummary,
    uploadedFiles,
    caseNote,
    eventNotes,
    bookmarksCount,
    upsertFromInvestigation,
  ]);
}

// Re-exported so callers that only need a one-off lookup (rather than a
// live subscription) don't have to import `lib/cases/storage.ts` directly
// alongside this store.
export { getCase as getCaseMetadataSnapshot };
