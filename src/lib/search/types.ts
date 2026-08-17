/**
 * Global Investigation Search — shared types (Phase 5.12).
 *
 * Pure data only, no React/Zustand/DOM I/O — mirrors every other feature's
 * `types.ts` in this project (e.g. `lib/cases/types.ts`, `lib/mitre/types.ts`,
 * `lib/export/types.ts`).
 */
import type { EventLevel, RiskLevel } from "@/types/evidence";
import type { ConfidenceLevel, DetectionSeverity } from "@/lib/detection/types";
import type { MitreTactic } from "@/lib/mitre/mapping";

export type SearchResultType = "event" | "ioc" | "mitre" | "note" | "bookmark" | "case";

export const SEARCH_RESULT_TYPE_LABEL: Record<SearchResultType, string> = {
  event: "Events",
  ioc: "IOC Findings",
  mitre: "MITRE ATT&CK",
  note: "Notes",
  bookmark: "Bookmarks",
  case: "Cases",
};

/** Kill-chain-ish display order for result groups (ticket "8. RESULT
 * GROUPS" lists them in this exact order). */
export const SEARCH_RESULT_TYPE_ORDER: SearchResultType[] = [
  "event",
  "ioc",
  "mitre",
  "note",
  "bookmark",
  "case",
];

/**
 * One search hit, already shaped for display — `SearchResultItem.tsx`
 * never reaches back into `evidenceStore`/`lib/mitre`/etc. to resolve
 * anything further, it only reads this struct. Extensible by design (every
 * field below the required core is optional): a future result type can add
 * new optional fields without breaking existing ones, matching this
 * phase's "Keep the types extensible" instruction.
 */
export interface SearchResult {
  /** Stable, globally unique across every result type (e.g. `"event:evt-1"`,
   * `"ioc:ioc-3"`) — used as the React key and for keyboard-selection
   * identity. */
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  description: string;
  /** Populated at query time by `searchEngine.ts` — 0 for an unscored
   * (not-yet-searched) entry. */
  score: number;
  /** Which fields the current query actually matched — drives which parts
   * of the card `SearchResultItem.tsx` highlights, and is also useful for
   * screen-reader summaries ("matched in message"). */
  matchedFields: string[];
  /** The original `EvtxEvent.eventId` (Windows Event ID, e.g. 4624) — set
   * on `event`/`ioc`/`bookmark` results (anything with a resolvable
   * source event), used for the "exact Event ID" ranking bonus. */
  eventId?: number;
  /** FK back to `EvtxEvent.id` (not the numeric Windows Event ID) — what
   * navigation actually needs to open the right row/drawer. */
  sourceEventId?: string;
  provider?: string;
  computer?: string;
  techniqueId?: string;
  tactic?: MitreTactic;
  severity?: DetectionSeverity;
  level?: EventLevel;
  threatLevel?: RiskLevel;
  /** Phase 5.13 — Detection Engine 2.0. Set on `ioc` results whenever the
   * underlying `DetectionFinding` was enriched with context-aware
   * confidence data (see `lib/detection/context/contextScoring.ts`);
   * undefined for any result type without a meaningful confidence concept.
   * Powers the `confidence:`/`risk:` advanced-query operators below and the
   * matching `SearchFilters.minConfidence`/`minRisk` panel fields. */
  confidence?: number;
  confidenceLevel?: ConfidenceLevel;
  riskScore?: number;
  timestamp?: string;
  /** Client-side route to navigate to when this result is chosen — always
   * a route already registered in `routes/index.tsx`; search never invents
   * a new one. */
  route?: string;
  /** Extra, router-state-only data a navigation handler needs beyond the
   * route itself (e.g. `{ focusEventId }`, `{ focusTechniqueId }|`) — kept
   * as a loose bag rather than a named field per consumer, since which
   * keys matter is entirely up to `SearchResultItem.tsx`'s navigation
   * switch, not this type. */
  metadata?: Record<string, string>;
}

export type SearchFilterType = SearchResultType | "all";

/**
 * Combine with AND logic (ticket "11. SEARCH FILTERS") — every non-default
 * field here narrows the result set further, never widens it.
 */
export interface SearchFilters {
  type: SearchFilterType;
  provider: string | null;
  computer: string | null;
  level: EventLevel | null;
  severity: DetectionSeverity | null;
  mitreTechnique: string | null;
  bookmarkedOnly: boolean;
  notesOnly: boolean;
  /** Phase 5.13 — Detection Engine 2.0. Minimum confidence/risk score
   * (0-100, inclusive) a result must carry to pass — `null` means no
   * threshold. Only `ioc` results currently carry `confidence`/`riskScore`
   * (see `SearchResult`), so these two filters are a no-op against every
   * other result type rather than excluding them; see `matchesFilters` in
   * `searchEngine.ts`. */
  minConfidence: number | null;
  minRisk: number | null;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  type: "all",
  provider: null,
  computer: null,
  level: null,
  severity: null,
  mitreTechnique: null,
  bookmarkedOnly: false,
  notesOnly: false,
  minConfidence: null,
  minRisk: null,
};

export function hasActiveSearchFilters(filters: SearchFilters): boolean {
  return (
    filters.type !== "all" ||
    filters.provider !== null ||
    filters.computer !== null ||
    filters.level !== null ||
    filters.severity !== null ||
    filters.mitreTechnique !== null ||
    filters.bookmarkedOnly ||
    filters.notesOnly ||
    filters.minConfidence !== null ||
    filters.minRisk !== null
  );
}

/** "12. ADVANCED QUERY SYNTAX" — the subset of `SearchFilters` a
 * `key:value` operator can set, plus the two boolean-shaped operators
 * (`bookmark:true`/`notes:true`) and `eventid:`/`type:`, which aren't
 * `SearchFilters` fields at all (`eventid` narrows by exact numeric id,
 * `type` reuses `SearchFilters.type`). Kept as its own type rather than
 * `Partial<SearchFilters>` because `eventId` has no `SearchFilters`
 * counterpart. */
export interface ParsedSearchQuery {
  /** Free-text portion left over after every recognized `key:value` token
   * was stripped out — this is what actually gets tokenized and searched
   * against the index. */
  freeText: string;
  eventId: number | null;
  provider: string | null;
  computer: string | null;
  level: EventLevel | null;
  severity: DetectionSeverity | null;
  mitreTechnique: string | null;
  type: SearchFilterType | null;
  bookmarkedOnly: boolean | null;
  notesOnly: boolean | null;
  /** Phase 5.13 — see `SearchFilters.minConfidence`/`minRisk` above; same
   * "0-100 inclusive minimum, null = no operator present" contract. */
  minConfidence: number | null;
  minRisk: number | null;
}

export interface SearchIndexCounts {
  events: number;
  iocs: number;
  mitre: number;
  notes: number;
  bookmarks: number;
  cases: number;
}

/** Result-group shape `SearchResults.tsx`/`SearchResultGroup.tsx` render —
 * built once per search by `searchEngine.ts`, not recomputed in the UI
 * layer (ticket "25. ARCHITECTURE CHECK — UI does not perform
 * aggregation"). */
export interface SearchResultGroupData {
  type: SearchResultType;
  results: SearchResult[];
}

export interface SearchResponse {
  query: string;
  /** The free-text portion of `query` left over after every recognized
   * `key:value` operator was parsed out (`parseAdvancedQuery`) — what
   * `SearchResultItem.tsx` actually highlights matches against, since
   * highlighting the raw query verbatim (operators included) would almost
   * never appear as a literal substring of any result's text. */
  freeText: string;
  filters: SearchFilters;
  groups: SearchResultGroupData[];
  totalCount: number;
  /** How long the actual `search()` call took, in milliseconds — surfaced
   * in the loading/empty-state copy for large cases ("Searching 100,000
   * events…"), not required for correctness. */
  durationMs: number;
}

/** Badge variant per IOC/MITRE severity — matches
 * `IOCFindingsPanel.tsx`'s own local `SEVERITY_VARIANT` mapping exactly,
 * duplicated here (not imported from that page component) so
 * `SearchResultItem.tsx` doesn't reach into an unrelated feature's
 * component file for a three-line constant — the same "small deliberate
 * duplication over a cross-feature import" precedent `lib/cases/types.ts`'s
 * `CASE_THREAT_BADGE_VARIANT` already established. */
export const SEARCH_SEVERITY_BADGE_VARIANT: Record<DetectionSeverity, "critical" | "warning" | "outline"> = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
};

/** "15. RECENT SEARCHES" — lightweight metadata only, never evidence. */
export interface RecentSearchEntry {
  id: string;
  query: string;
  timestamp: string; // ISO 8601
  filters: SearchFilters;
}
