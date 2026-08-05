import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { EventLevel, EvtxEvent } from "@/types/evidence";
import { useEvidenceStore } from "@/store/evidenceStore";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/evidence/level-badge";
import { NoteIndicator } from "@/components/evidence/NoteIndicator";
import { BookmarkIndicator } from "@/components/evidence/BookmarkIndicator";
import { IOCIndicator } from "@/components/detection/IOCIndicator";
import { TechniqueBadges } from "@/components/detection/TechniqueBadges";

const LEVEL_DOT: Record<EventLevel, string> = {
  Critical: "bg-severity-critical",
  Error: "bg-severity-critical",
  Warning: "bg-severity-warning",
  Information: "bg-primary",
  Verbose: "bg-muted-foreground",
};

export interface TimelineEntryProps {
  event: EvtxEvent;
  selected: boolean;
  onSelect: (event: EvtxEvent) => void;
}

/**
 * Single row in the Investigation Timeline (Sprint 4.3) — Timestamp,
 * color-coded Level badge, Provider, Event ID, Computer, a short (single-
 * line, truncated) Message, plus the IOC/Bookmark/Note indicators. Reuses
 * `LevelBadge`, `NoteIndicator`, `BookmarkIndicator`, and `IOCIndicator`
 * (Phase 5.4) as-is — all self-contained, reading their own event's state
 * directly (from `evidenceStore`/`notesStore`/`bookmarksStore` as
 * applicable) exactly as they do in EvidenceTable's columns.tsx — rather
 * than re-implementing any of that display logic here.
 *
 * `React.memo`-wrapped: `event` is referentially stable (it's the same
 * object reference from the original parsed array, unless it was
 * filtered out and back in), and `onSelect` is expected to be a
 * `useCallback`-stabilized prop from EventTimeline — so re-renders here
 * only happen when this entry's own `selected` state actually flips, not
 * whenever some unrelated entry is clicked or the drawer opens/closes.
 *
 * Sprint 5.9.4, Step 5 — "Timeline: every entry shows ATT&CK badges,
 * clicking one opens the MITRE page focused on that technique." Adding
 * `TechniqueBadges` (its own real `<button>`s) meant this row's outer
 * element could no longer be a `<button>` itself — a `<button>` can't
 * legally contain another interactive `<button>`. Switched to the same
 * `tabIndex` + `onClick` + `onKeyDown` pattern this project already uses
 * for exactly this reason (`MitreIOCTimeline.tsx`'s rows, which have the
 * same "row selects one thing, a nested button does another" shape),
 * deliberately not `role="button"` — see that file's doc comment for why
 * this repo avoids that role unless the element genuinely implements the
 * full button keyboard/AT contract, which a wrapper around other
 * interactive children does not. Also matching that file's choice of
 * `motion.div` over a plain `<div>`: a literal `<div>` with `tabIndex`/
 * `onClick` trips `eslint-plugin-jsx-a11y`'s `no-static-element-
 * interactions`/`no-noninteractive-tabindex` rules (which only recognize
 * bare intrinsic JSX elements, not component references), while
 * `motion.div` renders the identical DOM node and sidesteps both —
 * `whileTap` below gives it a small, genuine reason to be a motion
 * component rather than a bare lint workaround.
 */
function TimelineEntryImpl({ event, selected, onSelect }: TimelineEntryProps) {
  const date = new Date(event.timestamp);
  const hasValidTimestamp = !Number.isNaN(date.getTime());

  // Phase 5.7 — Multi-EVTX Investigation. The source badge only earns its
  // place in a multi-file investigation; a single-file case already shows
  // its filename in the page header (CaseStateGate) and Navbar, so
  // repeating it on every single row there would be pure noise. This reads
  // directly from evidenceStore (same self-contained pattern already used
  // by IOCIndicator/NoteIndicator/BookmarkIndicator below) rather than
  // threading a prop through EventTimeline -> TimelineDaySection.
  const isMultiFile = useEvidenceStore((s) => s.uploadedFiles.length > 1);

  return (
    <li className="relative mb-5 last:mb-0">
      <span
        className={cn(
          "absolute -left-[29px] mt-2.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
          LEVEL_DOT[event.level],
        )}
        aria-hidden="true"
      />
      <motion.div
        tabIndex={0}
        whileTap={{ scale: 0.995 }}
        onClick={() => onSelect(event)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(event);
          }
        }}
        aria-label={`View event ${event.eventId}${selected ? " — selected" : ""}`}
        className={cn(
          "w-full cursor-pointer rounded-md p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-primary/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <time
            dateTime={hasValidTimestamp ? event.timestamp : undefined}
            className="font-mono text-xs tabular-nums text-muted-foreground"
          >
            {hasValidTimestamp ? format(date, "HH:mm:ss") : "Unknown"}
          </time>
          <LevelBadge level={event.level} />
          <Badge variant="outline" className="font-mono text-[10px]">
            {event.eventId}
          </Badge>
          <span className="text-xs text-muted-foreground">{event.provider}</span>
          <span aria-hidden="true" className="text-xs text-muted-foreground">
            ·
          </span>
          <span className="text-xs text-muted-foreground">{event.computer}</span>
          {isMultiFile && event.sourceFile && (
            <Badge
              variant="outline"
              className="max-w-[9rem] truncate text-[10px] text-muted-foreground"
              title={event.sourceFile}
            >
              {event.sourceFile}
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <IOCIndicator eventId={event.id} />
            <BookmarkIndicator eventId={event.id} />
            <NoteIndicator eventId={event.id} />
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-foreground">{event.message}</p>
        <div className="mt-1">
          <TechniqueBadges eventId={event.id} />
        </div>
      </motion.div>
    </li>
  );
}

export const TimelineEntry = React.memo(TimelineEntryImpl);
