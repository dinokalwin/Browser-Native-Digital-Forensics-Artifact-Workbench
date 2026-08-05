/**
 * IOC Detection Engine — small generic helpers shared across rule files
 * (Phase 5.4). Deliberately trivial and dependency-free: sharing these
 * doesn't couple one rule's *detection logic* to another's (every rule
 * still only reads `DetectionContext` and returns its own findings), it
 * just avoids re-implementing "sort events by time" or "group by key" in
 * fourteen separate files.
 */
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionContext } from "./types";

/** Parsed timestamp in ms, or `+Infinity` for an unparseable/missing one so
 * such events sort last instead of corrupting a numeric comparison. */
export function parseTime(event: EvtxEvent): number {
  const ms = new Date(event.timestamp).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function sortByTimestamp(events: EvtxEvent[]): EvtxEvent[] {
  return [...events].sort((a, b) => parseTime(a) - parseTime(b));
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Groups events by "user@computer" — the correlation key most rules that
 * look for a *pattern of activity* (brute force, successful login after
 * failures) need. */
export function userHostKey(event: EvtxEvent): string {
  return `${event.user}@${event.computer}`;
}

/** Events matching a specific Windows Event ID, via the context's
 * precomputed grouping — never re-filters `ctx.events` directly. */
export function eventsFor(ctx: Pick<DetectionContext, "byEventCode">, code: number): EvtxEvent[] {
  return ctx.byEventCode.get(code) ?? [];
}
