/**
 * Pure, presentation-agnostic filtering over an already-parsed EVTX event
 * set. No React, no Zustand, no side effects — every export here is a plain
 * function of its arguments. This is the dashboard-wide "investigation
 * search" layer (FilterToolbar.tsx / DashboardPage.tsx); it's independent
 * of, and sits upstream of, the EvidenceTable's own existing per-column
 * search/sort (src/store/filterStore.ts) — that one keeps working exactly
 * as before, as a finer-grained refinement of whatever this layer narrows
 * the case down to first. See DashboardPage.tsx for how the two compose.
 *
 * Performance contract: `filterEvents` makes exactly one pass over
 * `events` (O(n)). Cheap, indexable-equality checks (provider, computer,
 * event ID, level) run before the more expensive multi-field substring
 * search, so non-matching events short-circuit as early as possible. No
 * intermediate arrays, no sorting, no per-event allocation beyond the
 * unavoidable `.toLowerCase()` calls needed for case-insensitive text
 * matching.
 */
import type { EventLevel, EvtxEvent } from "@/types/evidence";

/** The level dropdown's options, including "All" (no filter) and "Unknown" (a level string not in EventLevel — see LEVEL comment below). */
export const LEVEL_FILTER_OPTIONS = [
  "All",
  "Information",
  "Warning",
  "Error",
  "Critical",
  "Verbose",
  "Unknown",
] as const;

export type LevelFilterValue = (typeof LEVEL_FILTER_OPTIONS)[number];

export interface InvestigationFilters {
  /** Free-text query, matched case-insensitively across several fields. Empty string = no constraint. */
  search: string;
  /** Exact provider name, or null for "All Providers". */
  provider: string | null;
  /** Exact computer/hostname, or null for "All Computers". */
  computer: string | null;
  /** Exact event ID, or null for "All Event IDs". */
  eventId: number | null;
  /** Exact level, or "All" for no constraint. */
  level: LevelFilterValue;
}

export const DEFAULT_FILTERS: InvestigationFilters = {
  search: "",
  provider: null,
  computer: null,
  eventId: null,
  level: "All",
};

export function hasActiveFilters(filters: InvestigationFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.provider !== null ||
    filters.computer !== null ||
    filters.eventId !== null ||
    filters.level !== "All"
  );
}

/**
 * Parses the Event ID filter's raw text input into `number | null`.
 * Never throws: anything that isn't a non-negative integer (including an
 * empty string, partial input like "-", or non-numeric text) resolves to
 * `null` — "All Event IDs" — which is the only sensible non-throwing
 * behavior for a still-being-typed or invalid value.
 */
export function parseEventIdInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Case-insensitive substring match across the fields an investigator would
 * plausibly search by: event ID (as text, so "462" matches 4624), provider,
 * computer, message, username, and channel. `needle` must already be
 * lower-cased and trimmed by the caller (`filterEvents` does this once for
 * the whole filter pass, not per event).
 *
 * Note: the source ticket for this feature also asked to search "keywords
 * already stored in the event" — there is no such field on `EvtxEvent`
 * (see src/types/evidence.ts); adding one would mean touching evidence
 * mapping, which is out of scope for this sprint. This is a no-op omission
 * documented here rather than silently dropped.
 */
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
 * Applies all active filters to `events` in a single pass. Every
 * comparison is null-safe and exception-free — an empty `events` array, a
 * blank/"Unknown"-bucketed provider or computer, or a level value the
 * current data model never actually produces all just filter to zero
 * matches rather than throwing.
 */
export function filterEvents(
  events: readonly EvtxEvent[],
  filters: InvestigationFilters,
): EvtxEvent[] {
  const needle = filters.search.trim().toLowerCase();
  const hasSearch = needle.length > 0;
  const hasProvider = filters.provider !== null;
  const hasComputer = filters.computer !== null;
  const hasEventId = filters.eventId !== null;
  const hasLevel = filters.level !== "All";

  if (!hasSearch && !hasProvider && !hasComputer && !hasEventId && !hasLevel) {
    // Nothing active — return a fresh array (not the same reference) so
    // callers can rely on referential identity to mean "this is a filter
    // result", without needing a special case.
    return events.slice();
  }

  const result: EvtxEvent[] = [];
  for (const event of events) {
    if (hasProvider && event.provider !== filters.provider) continue;
    if (hasComputer && event.computer !== filters.computer) continue;
    if (hasEventId && event.eventId !== filters.eventId) continue;
    // `EventLevel` has no "Unknown" member today (see LEVEL_FILTER_OPTIONS'
    // doc comment) — comparing as strings keeps this forward-compatible
    // without requiring a cast or widening EvtxEvent's own type.
    if (hasLevel && (event.level as string) !== filters.level) continue;
    if (hasSearch && !matchesSearch(event, needle)) continue;
    result.push(event);
  }
  return result;
}

/** Unique provider names across `events`, alphabetically sorted, "Unknown" substituted for blank. */
export function getUniqueProviders(events: readonly EvtxEvent[]): string[] {
  const set = new Set<string>();
  for (const event of events) set.add(event.provider || "Unknown");
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Unique computer/hostnames across `events`, alphabetically sorted, "Unknown" substituted for blank. */
export function getUniqueComputers(events: readonly EvtxEvent[]): string[] {
  const set = new Set<string>();
  for (const event of events) set.add(event.computer || "Unknown");
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Re-exported purely so consumers of this module don't also need to import
// from types/evidence just to type a level value in a switch/map.
export type { EventLevel };
