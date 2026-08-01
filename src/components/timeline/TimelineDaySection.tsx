import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EvtxEvent } from "@/types/evidence";
import { Badge } from "@/components/ui/badge";
import { TimelineEntry } from "@/components/timeline/TimelineEntry";

export interface TimelineDaySectionProps {
  label: string;
  events: EvtxEvent[];
  defaultExpanded: boolean;
  selectedEventId: string | undefined;
  onSelectEvent: (event: EvtxEvent) => void;
}

/**
 * Collapsible per-day group (Sprint 4.3's "Grouping" requirement). Same
 * disclosure interaction already established in this codebase for Raw XML
 * inside EventDetailsDrawer.tsx (a plain button + rotating `ChevronRight`
 * + conditional render, rather than a new dependency) — reused here for
 * consistency instead of introducing a different collapsible pattern.
 *
 * Collapsed sections don't render their `TimelineEntry` list at all
 * (rather than hiding it with CSS), which is also this page's main
 * defense against a very large case producing a very large DOM: with only
 * the most recent day expanded by default, most events in a big log never
 * mount until the investigator actually opens that day.
 */
export function TimelineDaySection({
  label,
  events,
  defaultExpanded,
  selectedEventId,
  onSelectEvent,
}: TimelineDaySectionProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <section className="mb-8 last:mb-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mb-4 flex w-full items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
          aria-hidden="true"
        />
        {label}
        <Badge variant="outline" className="ml-1 font-mono text-[10px]">
          {events.length}
        </Badge>
      </button>

      {expanded && (
        <ol className="relative border-l border-border pl-6">
          {events.map((event) => (
            <TimelineEntry
              key={event.id}
              event={event}
              selected={selectedEventId === event.id}
              onSelect={onSelectEvent}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
