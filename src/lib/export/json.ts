/**
 * Export Center — JSON builders (Phase 5.11).
 *
 * Pure, framework-free: no React, no DOM beyond the `Blob` constructor.
 * Every payload here is prefixed with the same `ExportMetadataHeader`
 * (caseId/caseName/generatedAt/sourceFiles/eventCount — this phase's
 * ticket "7. JSON" requirement) so a file opened outside the app is still
 * self-describing.
 *
 * Evidence JSON is a genuinely new payload shape rather than a reuse of
 * `backend/json-export.ts#exportEventsAsJSON`: that existing export (still
 * used unchanged by `components/evidence/ExportControls.tsx`'s toolbar)
 * only carries `exportedAt`/`eventCount`/`events`, not the
 * caseId/caseName/sourceFiles this phase explicitly requires every JSON
 * export to include — so this module defines its own, richer payload
 * instead of bolting fields onto a contract another component already
 * depends on. IOC/MITRE/Notes/Bookmarks JSON have no pre-existing export
 * to reuse at all, matching this phase's "create reusable builders where
 * necessary" instruction.
 *
 * Every array field is typed `readonly` and stored by reference, never
 * copied (`Array.prototype.slice()`), per this phase's "avoid unnecessary
 * copies" performance requirement — `JSON.stringify` doesn't care whether
 * its input is mutable.
 */
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreTechniqueSummary } from "@/lib/mitre/types";
import type { CaseNote, EventNoteMap } from "@/lib/notes";
import type { BookmarkMap } from "@/lib/bookmarks";
import type { ExportMetadataHeader } from "./types";

function jsonBlob(payload: unknown): Blob {
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

export interface EvidenceJsonPayload {
  metadata: ExportMetadataHeader;
  events: readonly EvtxEvent[];
}

export function buildEvidenceJsonBlob(metadata: ExportMetadataHeader, events: readonly EvtxEvent[]): Blob {
  const payload: EvidenceJsonPayload = { metadata, events };
  return jsonBlob(payload);
}

export interface IocJsonPayload {
  metadata: ExportMetadataHeader;
  findings: readonly DetectionFinding[];
}

/**
 * Phase 5.13 note: `DetectionFinding`'s new optional
 * `confidence`/`confidenceLevel`/`riskScore`/`evidenceSignals`/`context`
 * fields (see `lib/detection/types.ts`) are already carried through here
 * with no code change — `findings` is whatever `evidenceStore` got back
 * from `runDetectionEngine` (already enriched), and this function
 * serializes each finding object whole rather than picking specific
 * fields, unlike `lib/export/csv.ts#buildIocCsvText`, which does need an
 * explicit column list and was extended accordingly.
 */

export function buildIocJsonBlob(metadata: ExportMetadataHeader, findings: readonly DetectionFinding[]): Blob {
  const payload: IocJsonPayload = { metadata, findings };
  return jsonBlob(payload);
}

export interface MitreJsonPayload {
  metadata: ExportMetadataHeader;
  techniques: readonly MitreTechniqueSummary[];
}

export function buildMitreJsonBlob(metadata: ExportMetadataHeader, techniques: readonly MitreTechniqueSummary[]): Blob {
  const payload: MitreJsonPayload = { metadata, techniques };
  return jsonBlob(payload);
}

export interface NotesJsonPayload {
  metadata: ExportMetadataHeader;
  caseNote: { text: string; updatedAt: string } | null;
  eventNotes: Array<{ eventId: string; text: string; updatedAt: string }>;
}

/**
 * `eventNotes` is reshaped from the store's `eventId -> EventNote` map into
 * an array (a plain object payload isn't as friendly to downstream
 * tooling — jq, pandas, spreadsheet import — as an array of records with
 * the key folded in as a field), same "map -> array of records" reshaping
 * `lib/report.ts#buildReportData` already does for `ReportEventNote`.
 */
export function buildNotesJsonBlob(metadata: ExportMetadataHeader, caseNote: CaseNote | null, eventNotes: EventNoteMap): Blob {
  const payload: NotesJsonPayload = {
    metadata,
    caseNote: caseNote ? { text: caseNote.text, updatedAt: caseNote.updatedAt } : null,
    eventNotes: Object.entries(eventNotes).map(([eventId, note]) => ({
      eventId,
      text: note.text,
      updatedAt: note.updatedAt,
    })),
  };
  return jsonBlob(payload);
}

export interface BookmarksJsonPayload {
  metadata: ExportMetadataHeader;
  bookmarkedEventIds: string[];
}

export function buildBookmarksJsonBlob(metadata: ExportMetadataHeader, bookmarks: BookmarkMap): Blob {
  const payload: BookmarksJsonPayload = { metadata, bookmarkedEventIds: Object.keys(bookmarks) };
  return jsonBlob(payload);
}
