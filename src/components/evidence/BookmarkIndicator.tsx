import * as React from "react";
import { Star } from "lucide-react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { useIsBookmarked, useEnsureCaseBookmarksLoaded } from "@/store/bookmarksStore";

interface BookmarkIndicatorProps {
  /** EvtxEvent.id for this row. */
  eventId: string;
}

/**
 * Read-only "this event is bookmarked" marker for the Evidence Table
 * (Sprint 4.2's "Evidence Table" requirement — a filled star, no text, for
 * bookmarked rows only). Toggling a bookmark happens in the Event Details
 * Drawer (BookmarkToggleButton.tsx), not here — this is purely a display.
 *
 * Same structure as NoteIndicator.tsx: reads `caseId` itself (columns.tsx
 * is a plain `ColumnDef[]` array with no prop-passing mechanism) and
 * subscribes to only this event's boolean via `useIsBookmarked`, so
 * bookmarking one event doesn't re-render any other row's indicator.
 * `React.memo`-wrapped as a second guard against unnecessary re-renders
 * across a table that can hold thousands of rows.
 */
function BookmarkIndicatorImpl({ eventId }: BookmarkIndicatorProps) {
  const caseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);
  useEnsureCaseBookmarksLoaded(caseId);
  const bookmarked = useIsBookmarked(caseId, eventId);

  if (!bookmarked) return null;

  return (
    <span title="Bookmarked" className="inline-flex">
      <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
      <span className="sr-only">Bookmarked</span>
    </span>
  );
}

export const BookmarkIndicator = React.memo(BookmarkIndicatorImpl);
