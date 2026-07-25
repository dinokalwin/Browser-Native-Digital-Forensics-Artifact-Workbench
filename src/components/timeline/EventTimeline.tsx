import * as React from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import type { EventLevel, EvtxEvent } from "@/types/evidence";
import { useUIStore } from "@/store/uiStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const LEVEL_DOT: Record<EventLevel, string> = {
  Critical: "bg-severity-critical",
  Error: "bg-severity-critical",
  Warning: "bg-severity-warning",
  Information: "bg-primary",
  Verbose: "bg-muted-foreground",
};

interface EventTimelineProps {
  events: EvtxEvent[];
}

/**
 * Chronological event list grouped by day, most recent first. Clicking
 * an entry sets `uiStore.selectedEvent` — the same cross-panel selection
 * the Evidence Table writes to — so a future detail panel can react to
 * either surface.
 *
 * Renders every event in the DOM (no virtualization) — fine at the scale
 * exercised so far, but worth revisiting with a windowing library if
 * real-world logs with tens of thousands of events make this page feel
 * sluggish.
 */
export function EventTimeline({ events }: EventTimelineProps) {
  const selectedEvent = useUIStore((s) => s.selectedEvent);
  const selectEvent = useUIStore((s) => s.selectEvent);

  const groups = React.useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const map = new Map<string, EvtxEvent[]>();
    for (const event of sorted) {
      const day = format(new Date(event.timestamp), "EEEE, MMMM d, yyyy");
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(event);
    }
    return Array.from(map.entries());
  }, [events]);

  return (
    <ScrollArea className="h-[calc(100vh-16rem)] min-h-80 rounded-lg border border-border">
      <div className="p-4 sm:p-6">
        {groups.map(([day, dayEvents]) => (
          <section key={day} className="mb-8 last:mb-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </h3>
            <ol className="relative border-l border-border pl-6">
              {dayEvents.map((event) => (
                <li key={event.id} className="relative mb-5 last:mb-0">
                  <span
                    className={cn(
                      "absolute -left-[29px] mt-2.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                      LEVEL_DOT[event.level],
                    )}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => selectEvent(event)}
                    className={cn(
                      "w-full rounded-md p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selectedEvent?.id === event.id && "bg-primary/5",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <time
                        dateTime={event.timestamp}
                        className="font-mono text-xs tabular-nums text-muted-foreground"
                      >
                        {format(new Date(event.timestamp), "HH:mm:ss")}
                      </time>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {event.eventId}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{event.provider}</span>
                      <span aria-hidden="true" className="text-xs text-muted-foreground">
                        ·
                      </span>
                      <span className="text-xs text-muted-foreground">{event.computer}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-foreground">{event.message}</p>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}
