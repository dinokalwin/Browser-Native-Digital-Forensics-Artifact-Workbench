/**
 * Client-side JSON export — straightforward, but kept as its own module
 * (rather than inlined at the call site) so the export contract mirrors
 * exportCSV's and stays easy to test independently.
 */
import type { EvtxEvent } from "@/types/evidence";

export function exportEventsAsJSON(events: EvtxEvent[]): Blob {
  const payload = {
    exportedAt: new Date().toISOString(),
    eventCount: events.length,
    events,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}
