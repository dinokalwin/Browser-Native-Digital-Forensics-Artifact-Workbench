/**
 * Pure, presentation-agnostic statistics over an already-parsed EVTX event
 * set. No React, no Zustand, no side effects — every export here is a plain
 * function of its arguments, safe to call from a component, a Web Worker,
 * or a unit test with identical results.
 *
 * Performance contract: `calculateStatistics` makes exactly one pass over
 * `events` (O(n)), uses `Set` for the three uniqueness counts, and performs
 * no per-event allocation beyond what `Set.add` itself requires — no
 * `.filter()`/`.map()` intermediate arrays, no sorting. This is what keeps
 * it responsive for the 50k+ event logs this app is designed to handle.
 */
import { format } from "date-fns";

import type { EvtxEvent } from "@/types/evidence";

export interface InvestigationStatistics {
  totalEvents: number;
  uniqueProviders: number;
  uniqueComputers: number;
  uniqueEventIds: number;
  /** null when the log has no events with a parseable timestamp. */
  earliestTimestamp: Date | null;
  /** null when the log has no events with a parseable timestamp. */
  latestTimestamp: Date | null;
}

const UNKNOWN_LABEL = "Unknown";

/**
 * Computes all investigation-summary statistics in a single traversal.
 *
 * Edge cases handled without throwing:
 * - `events` is empty -> every count is 0, both timestamps are null.
 * - a blank/missing `provider` or `computer` -> bucketed under "Unknown"
 *   rather than silently dropped, so the unique count still reflects reality
 *   (this mirrors record-mapper.ts's own "Unknown" fallback, but is applied
 *   defensively here too since this function must stand on its own for any
 *   caller, not just the current parser).
 * - a missing timestamp (`""`, from a record whose FILETIME couldn't be
 *   decoded — see record-mapper.ts's `safeTimestamp`) or an unparseable one
 *   -> excluded from the earliest/latest comparison, never produces
 *   `Invalid Date` or `NaN` in the result.
 * - duplicate event IDs -> collapsed naturally by `Set`.
 */
export function calculateStatistics(events: readonly EvtxEvent[]): InvestigationStatistics {
  const providers = new Set<string>();
  const computers = new Set<string>();
  const eventIds = new Set<number>();

  let earliestMs: number | null = null;
  let latestMs: number | null = null;

  for (const event of events) {
    providers.add(event.provider || UNKNOWN_LABEL);
    computers.add(event.computer || UNKNOWN_LABEL);
    eventIds.add(event.eventId);

    if (!event.timestamp) continue;
    const ms = Date.parse(event.timestamp);
    if (Number.isNaN(ms)) continue;

    if (earliestMs === null || ms < earliestMs) earliestMs = ms;
    if (latestMs === null || ms > latestMs) latestMs = ms;
  }

  return {
    totalEvents: events.length,
    uniqueProviders: providers.size,
    uniqueComputers: computers.size,
    uniqueEventIds: eventIds.size,
    earliestTimestamp: earliestMs === null ? null : new Date(earliestMs),
    latestTimestamp: latestMs === null ? null : new Date(latestMs),
  };
}

/** Full-precision timestamp for display, or "N/A" when there's nothing to show. */
export function formatDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return format(date, "MMM d, yyyy HH:mm:ss");
}

/** Date-only, no time-of-day (e.g. "Feb 20, 2026"), or "N/A" when there's nothing to show. */
export function formatShortDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return format(date, "MMM d, yyyy");
}

/**
 * Compact date-only range for a stat card's headline value. Collapses to a
 * single date when the log's earliest and latest events fall on the same
 * calendar day, so a short investigation doesn't render a redundant
 * "Jan 3, 2024 – Jan 3, 2024".
 */
export function formatDateRange(earliest: Date | null, latest: Date | null): string {
  const start = formatShortDate(earliest);
  const end = formatShortDate(latest);
  if (start === "N/A" || end === "N/A") return "N/A";
  return start === end ? start : `${start} – ${end}`;
}

/**
 * Human-readable span between two timestamps (e.g. "6d 4h", "12m", "45s").
 * Shows only the two most significant non-zero units so the value stays
 * short enough for a card, falling back to seconds for sub-minute spans and
 * to "N/A" for missing/invalid/negative input (a negative span can only
 * mean corrupt timestamp data, not a real duration — never displayed as if
 * it were one).
 */
export function formatDuration(earliest: Date | null, latest: Date | null): string {
  if (!earliest || !latest || Number.isNaN(earliest.getTime()) || Number.isNaN(latest.getTime())) {
    return "N/A";
  }
  const totalMs = latest.getTime() - earliest.getTime();
  if (totalMs < 0) return "N/A";
  if (totalMs === 0) return "Instant";

  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const units: Array<{ value: number; suffix: string }> =
    days > 0
      ? [
          { value: days, suffix: "d" },
          { value: hours, suffix: "h" },
        ]
      : hours > 0
        ? [
            { value: hours, suffix: "h" },
            { value: minutes, suffix: "m" },
          ]
        : minutes > 0
          ? [
              { value: minutes, suffix: "m" },
              { value: seconds, suffix: "s" },
            ]
          : [{ value: seconds, suffix: "s" }];

  const rendered = units
    .filter((unit) => unit.value > 0)
    .map((unit) => `${unit.value}${unit.suffix}`)
    .join(" ");

  return rendered || "0s";
}
