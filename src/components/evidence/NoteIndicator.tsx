import * as React from "react";
import { StickyNote } from "lucide-react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { useHasEventNote, useEnsureCaseNotesLoaded } from "@/store/notesStore";

interface NoteIndicatorProps {
  /** EvtxEvent.id for this row. */
  eventId: string;
}

/**
 * Small "this event has an investigator note" marker for the Evidence
 * Table (Sprint 4.1's "Visual Indicators" requirement). Reads `caseId`
 * itself (rather than being threaded down through columns.tsx, which is a
 * plain `ColumnDef[]` array with no prop-passing mechanism of its own) and
 * subscribes to only *this* event's `hasNote` boolean via
 * `useHasEventNote` — editing a different event's note produces the same
 * boolean for every other row's instance of this component, so Zustand's
 * shallow-equality check skips re-rendering them. `React.memo`-wrapped on
 * top of that as a second guard: with EvidenceTable.tsx handling
 * potentially thousands of events, only the row whose own note actually
 * changed should ever re-render, never the rest of the table.
 */
function NoteIndicatorImpl({ eventId }: NoteIndicatorProps) {
  const caseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);
  useEnsureCaseNotesLoaded(caseId);
  const hasNote = useHasEventNote(caseId, eventId);

  if (!hasNote) return null;

  return (
    <span title="This event has an investigator note" className="inline-flex">
      <StickyNote className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span className="sr-only">Has investigator note</span>
    </span>
  );
}

export const NoteIndicator = React.memo(NoteIndicatorImpl);
