import * as React from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import type { EventLevel, EvtxEvent } from "@/types/evidence";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/evidence/level-badge";
import { NoteIndicator } from "@/components/evidence/NoteIndicator";
import { BookmarkIndicator } from "@/components/evidence/BookmarkIndicator";

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
 * line, truncated) Message, plus the Bookmark/Note indicators. Reuses
 * `LevelBadge`, `NoteIndicator`, and `BookmarkIndicator` as-is (all three
 * already self-contained: `NoteIndicator`/`BookmarkIndicator` read the
 * active case and their own event's state directly, exactly as they do
 * in EvidenceTable's columns.tsx) rather than re-implementing any of
 * that display logic here.
 *
 * `React.memo`-wrapped: `event` is referentially stable (it's the same
 * object reference from the original parsed array, unless it was
 * filtered out and back in), and `onSelect` is expected to be a
 * `useCallback`-stabilized prop from EventTimeline — so re-renders here
 * only happen when this entry's own `selected` state actually flips, not
 * whenever some unrelated entry is clicked or the drawer opens/closes.
 */
function TimelineEntryImpl({ event, selected, onSelect }: TimelineEntryProps) {
  const date = new Date(event.timestamp);
  const hasValidTimestamp = !Number.isNaN(date.getTime());

  return (
    <li className="relative mb-5 last:mb-0">
      <span
        className={cn(
          "absolute -left-[29px] mt-2.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
          LEVEL_DOT[event.level],
        )}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => onSelect(event)}
        className={cn(
          "w-full rounded-md p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          <span className="ml-auto flex items-center gap-1.5">
            <BookmarkIndicator eventId={event.id} />
            <NoteIndicator eventId={event.id} />
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-foreground">{event.message}</p>
      </button>
    </li>
  );
}

export const TimelineEntry = React.memo(TimelineEntryImpl);
