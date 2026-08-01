/**
 * Pure, presentation-agnostic logic for the Investigation Timeline page
 * (Sprint 4.3). No React, no Zustand, no side effects — same contract as
 * `lib/eventFilters.ts` / `lib/statistics.ts`, which this module
 * deliberately *reuses* (`calculateStatistics`, `formatDateRange`,
 * `formatDuration`, `LEVEL_FILTER_OPTIONS`, `getUniqueProviders`) rather
 * than duplicating: importing/calling those exports isn't a modification
 * to the filtering engine or statistics calculations, just consuming
 * them, the same way DashboardPage/FilterToolbar already do.
 *
 * `TimelineFilters` is intentionally a separate type from
 * `InvestigationFilters` (lib/eventFilters.ts) rather than an extension of
 * it: the Timeline toolbar's field set (search/provider/level/bookmarked/
 * notes) doesn't match the Dashboard's (search/provider/computer/eventId/
 * level), and this sprint's brief is explicit that the filtering engine
 * itself must not be touched — so this is new, self-contained logic
 * scoped to the Timeline page only, not a change to that engine.
 */
import { format } from "date-fns";

import type { EvtxEvent } from "@/types/evidence";
import { calculateStatistics, formatDateRange, formatDuration } from "@/lib/statistics";
import { LEVEL_FILTER_OPTIONS, getUniqueProviders, type LevelFilterValue } from "@/lib/eventFilters";

export { LEVEL_FILTER_OPTIONS, getUniqueProviders };
export type { LevelFilterValue };

export interface TimelineFilters {
  search: string;
  provider: string | null;
  level: LevelFilterValue;
  bookmarkedOnly: boolean;
  notesOnly: boolean;
}

export const DEFAULT_TIMELINE_FILTERS: TimelineFilters = {
  search: "",
  provider: null,
  level: "All",
  bookmarkedOnly: false,
  notesOnly: false,
};

export function hasActiveTimelineFilters(filters: TimelineFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.provider !== null ||
    filters.level !== "All" ||
    filters.bookmarkedOnly ||
    filters.notesOnly
  );
}

function matchesSearch(event: EvtxEvent, needle: string): boolean {
  return (
    String(event.eventId).includes(needle) ||
    event.provider.toLowerCase().includes(needle) ||
    event.computer.toLowerCase().includes(needle) ||
    event.message.toLowerCase().includes(needle) ||
    event.user.toLowerCase().includes(needle) ||
    event.channel.toLowerCase().includes(needle)
  );
}

/**
 * Applies the Timeline toolbar's filters in a single pass. `bookmarkedIds`/
 * `notedIds` are plain presence maps (eventId -> truthy) — callers pass in
 * whatever `bookmarksStore`/`notesStore` currently hold for the active
 * case; this function never reads either store itself, keeping it pure
 * and keeping this sprint from touching either store's own files.
 */
export function filterTimelineEvents(
  events: readonly EvtxEvent[],
  filters: TimelineFilters,
  bookmarkedIds: Readonly<Record<string, unknown>>,
  notedIds: Readonly<Record<string, unknown>>,
): EvtxEvent[] {
  const needle = filters.search.trim().toLowerCase();
  const hasSearch = needle.length > 0;
  const hasProvider = filters.provider !== null;
  const hasLevel = filters.level !== "All";

  if (!hasSearch && !hasProvider && !hasLevel && !filters.bookmarkedOnly && !filters.notesOnly) {
    return events.slice();
  }

  const result: EvtxEvent[] = [];
  for (const event of events) {
    if (hasProvider && event.provider !== filters.provider) continue;
    if (hasLevel && (event.level as string) !== filters.level) continue;
    if (filters.bookmarkedOnly && !bookmarkedIds[event.id]) continue;
    if (filters.notesOnly && !notedIds[event.id]) continue;
    if (hasSearch && !matchesSearch(event, needle)) continue;
    result.push(event);
  }
  return result;
}

export interface TimelineDayGroup {
  /** Stable sort/React key, e.g. "2026-07-31" — independent of locale/format. */
  key: string;
  /** Display heading, e.g. "Friday, July 31, 2026". */
  label: string;
  events: EvtxEvent[];
}

/**
 * Groups events by calendar day, most recent day first (each day's own
 * events sorted most-recent-first too) — same ordering the original
 * (pre-Sprint-4.3) EventTimeline used. Events with a missing/unparseable
 * timestamp are bucketed under a single "Unknown Date" group at the end
 * rather than dropped or throwing.
 */
export function groupEventsByDay(events: readonly EvtxEvent[]): TimelineDayGroup[] {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const map = new Map<string, TimelineDayGroup>();
  const unknown: EvtxEvent[] = [];

  for (const event of sorted) {
    const date = new Date(event.timestamp);
    if (Number.isNaN(date.getTime())) {
      unknown.push(event);
      continue;
    }
    const key = format(date, "yyyy-MM-dd");
    let group = map.get(key);
    if (!group) {
      group = { key, label: format(date, "EEEE, MMMM d, yyyy"), events: [] };
      map.set(key, group);
    }
    group.events.push(event);
  }

  const groups = Array.from(map.values());
  if (unknown.length > 0) {
    groups.push({ key: "unknown", label: "Unknown Date", events: unknown });
  }
  return groups;
}

export interface TimelineStatistics {
  totalEvents: number;
  bookmarkedEvents: number;
  eventsWithNotes: number;
  /** e.g. "Feb 20, 2026 – Jul 31, 2026", or "N/A" if there's nothing to show. */
  spanRange: string;
  /** e.g. "161d 2h", or "N/A" if there's nothing to show. */
  spanDuration: string;
}

/**
 * Timeline-wide statistics — deliberately computed from the *whole* case
 * (`events` here is expected to be the full, unfiltered event set, mirroring
 * how the Dashboard's own Statistics Cards stay case-wide regardless of the
 * Investigation Filters below them), not whatever the toolbar currently
 * narrows the visible list to. `calculateStatistics` is reused as-is for
 * `totalEvents` and the earliest/latest timestamps that `formatDateRange`/
 * `formatDuration` (also reused as-is) turn into the span fields —
 * bookmarked/noted counts are the only genuinely new computation here.
 */
export function calculateTimelineStatistics(
  events: readonly EvtxEvent[],
  bookmarkedIds: Readonly<Record<string, unknown>>,
  notedIds: Readonly<Record<string, unknown>>,
): TimelineStatistics {
  const base = calculateStatistics(events);

  let bookmarkedEvents = 0;
  let eventsWithNotes = 0;
  for (const event of events) {
    if (bookmarkedIds[event.id]) bookmarkedEvents += 1;
    if (notedIds[event.id]) eventsWithNotes += 1;
  }

  return {
    totalEvents: base.totalEvents,
    bookmarkedEvents,
    eventsWithNotes,
    spanRange: formatDateRange(base.earliestTimestamp, base.latestTimestamp),
    spanDuration: formatDuration(base.earliestTimestamp, base.latestTimestamp),
  };
}
