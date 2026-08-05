import * as React from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import { Badge } from "@/components/ui/badge";

interface MitreIOCTimelineProps {
  findings: DetectionFinding[];
  /** `EvtxEvent.id -> EvtxEvent`, already built once by `MitreFindingDrawer`
   * (the same map it uses to resolve "Affected Events") — passed down
   * rather than rebuilt here, so this component never touches the full
   * `events` array itself. */
  eventsById: ReadonlyMap<string, EvtxEvent>;
  /** The small "view event" icon-button on a row resolves this finding's
   * event and opens it in the existing `EventDetailsDrawer` (Sprint 5.9.2,
   * Step 7) — reused as-is, not reimplemented. Absent when the finding's
   * event no longer resolves. */
  onSelectEvent: (event: EvtxEvent) => void;
  /** Sprint 5.9.3, Step 7 — clicking anywhere else on a row "selects" that
   * IOC: `MitreAttackPage` uses this to (re-)confirm the technique
   * highlighted in the Coverage Matrix and to mark this row via
   * `selectedFindingId` below. Every row here already belongs to the same
   * technique (this timeline only ever shows one technique's findings at
   * a time), so selecting a row can't change *which* cell is glowing in
   * the matrix — it gives the analyst visible confirmation that this
   * specific finding, not just its technique, is the one they clicked. */
  onSelectFinding?: (finding: DetectionFinding) => void;
  /** The finding currently marked "selected" (see `onSelectFinding`), or
   * `null`/`undefined` when none is. */
  selectedFindingId?: string | null;
}

const SEVERITY_DOT: Record<DetectionFinding["severity"], string> = {
  critical: "bg-severity-critical",
  warning: "bg-severity-warning",
  informational: "bg-primary",
};

const SEVERITY_BADGE: Record<DetectionFinding["severity"], "critical" | "warning" | "outline"> = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
};

/**
 * Chronological IOC finding timeline (Sprint 5.9.2, Step 6) — reuses the
 * exact visual language `TimelineEntry.tsx` established for the
 * Investigation Timeline (left dot rail, monospaced time, hover/focus
 * states) rather than inventing a second timeline look, adapted to
 * `DetectionFinding` instead of `EvtxEvent` (a severity-colored dot in
 * place of a level-colored one, since findings don't carry an `EventLevel`
 * of their own).
 *
 * Sorting happens here, not in `lib/mitre/*`: it's a presentation-time
 * ordering of an already-small, already-computed `findings` array (at most
 * a few dozen items — one technique's worth), not a second aggregation
 * pass, so it doesn't need to live in the pure `lib/mitre` layer to keep
 * that layer's "single pass over `iocFindings`" contract intact.
 *
 * Sprint 5.9.3, Step 6 ("Timeline Integration") — every entry here already
 * belongs to whichever technique is currently selected in the matrix (see
 * `MitreFindingDrawer`'s doc comment: this timeline only ever receives one
 * technique's `findings`), so a fresh set of entries lighting up *is* the
 * "selecting a technique highlights matching IOC timeline entries"
 * behavior — reinforced here with a brief highlight-fade-in
 * (`framer-motion`, `key={technique's findings}`) so switching techniques
 * reads as a visible transition rather than the list silently swapping.
 *
 * Step 7 ("Event Synchronization") is the reverse direction: each row is
 * now a `tabIndex`-managed, keyboard-operable selection target of its own
 * (`onSelectFinding`) — a `<div>`, not a `<button>`, specifically so it can
 * contain a real nested `<button>` for the separate "view event" action
 * (`onSelectEvent`) without creating an invalid button-inside-button DOM
 * (the same div+tabIndex+onKeyDown pattern `MitreTechniqueTable.tsx`'s
 * rows already use, and for the same reason — see that file's doc comment
 * on why `role="button"` was deliberately left off).
 */
export function MitreIOCTimeline({
  findings,
  eventsById,
  onSelectEvent,
  onSelectFinding,
  selectedFindingId,
}: MitreIOCTimelineProps) {
  const sorted = React.useMemo(() => {
    return findings
      .map((finding) => ({ finding, event: eventsById.get(finding.eventId) ?? null }))
      .sort((a, b) => {
        const aTime = a.event?.timestamp ? new Date(a.event.timestamp).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.event?.timestamp ? new Date(b.event.timestamp).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
  }, [findings, eventsById]);

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No IOC findings to display on the timeline.</p>;
  }

  // Keys the highlight-fade-in below — changes whenever the *set* of
  // findings shown changes (i.e. whenever the matrix selection switches to
  // a different technique), so the whole list visibly "lights up" on
  // every technique switch without replaying on every unrelated re-render.
  const timelineKey = findings.map((f) => f.id).join("|");

  return (
    <ol className="relative border-l border-border pl-6">
      {sorted.map(({ finding, event }) => {
        // A nullable local (not a non-null assertion) so TypeScript narrows
        // `validTimestamp` itself in the ternaries below, rather than
        // needing `event!.timestamp` repeated at each use — this project
        // avoids non-null assertions in favor of exactly this kind of
        // defensive narrowing (see `aggregation.ts`'s own doc comment on
        // the same convention).
        const validTimestamp =
          event?.timestamp && !Number.isNaN(new Date(event.timestamp).getTime()) ? event.timestamp : null;
        const selected = finding.id === selectedFindingId;

        return (
          <li key={finding.id} className="relative mb-5 last:mb-0">
            <span
              className={cn(
                "absolute -left-[29px] mt-2.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                SEVERITY_DOT[finding.severity],
              )}
              aria-hidden="true"
            />
            <motion.div
              key={`${timelineKey}-${finding.id}`}
              initial={{ backgroundColor: "hsl(var(--primary) / 0.25)" }}
              animate={{ backgroundColor: "hsl(var(--primary) / 0)" }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              tabIndex={onSelectFinding ? 0 : undefined}
              aria-label={
                onSelectFinding ? `Select finding: ${finding.title}${selected ? " — selected" : ""}` : undefined
              }
              onClick={onSelectFinding ? () => onSelectFinding(finding) : undefined}
              onKeyDown={
                onSelectFinding
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectFinding(finding);
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex items-start justify-between gap-2 rounded-md p-2 transition-colors",
                onSelectFinding && "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "bg-primary/10 ring-1 ring-primary",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <time
                    dateTime={validTimestamp ?? undefined}
                    className="font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    {validTimestamp ? format(new Date(validTimestamp), "MMM d, HH:mm:ss") : "Unknown time"}
                  </time>
                  <Badge variant={SEVERITY_BADGE[finding.severity]} className="capitalize">
                    {finding.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{finding.ruleName}</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-foreground">{finding.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{finding.description}</p>
              </div>
              {event && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(event);
                  }}
                  aria-label={`View event ${event.eventId} in the event inspector`}
                  title="View event"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
