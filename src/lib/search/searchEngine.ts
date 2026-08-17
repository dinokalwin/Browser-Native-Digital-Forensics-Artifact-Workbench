/**
 * Global Investigation Search — query execution (Phase 5.12).
 *
 * Pure, framework-free: no React, no Zustand. Operates ONLY against an
 * already-built `SearchIndex` (`indexBuilder.ts`) — this module never
 * receives raw `events`/`iocFindings`/etc. and never re-derives anything
 * from them, which is what makes a search call cheap regardless of case
 * size: the expensive O(n) work already happened once, at index-build
 * time.
 *
 * Performance contract (ticket "4. PERFORMANCE"): when the query has any
 * free-text tokens, candidate entries are gathered ONLY from the index's
 * `byToken`/`byEventId`/`byTechniqueId` maps — never a `.filter()` over
 * every entry. The one case that *does* touch every entry is a
 * filters-only browse (free text empty, at least one filter/operator
 * active, e.g. "show me every bookmark") — that's an intentional, bounded
 * linear pass over the index (not the raw event arrays), equivalent to
 * any filter panel, and results are still capped before returning.
 */
import { tokenizeSearchQuery, parseAdvancedQuery } from "./tokenizer";
import {
  computeMatchedFields,
  detectExactEventId,
  detectExactTechniqueId,
  scoreEntry,
  type RankingContext,
} from "./ranking";
import type { IndexedEntry, SearchIndex } from "./indexBuilder";
import {
  SEARCH_RESULT_TYPE_ORDER,
  type SearchFilters,
  type SearchResponse,
  type SearchResultGroupData,
  type SearchResultType,
} from "./types";

/** Hard ceiling per group, applied after ranking — keeps rendering (and
 * the highlighting pass over each visible result) cheap even when a
 * broad query legitimately matches thousands of events. `totalCount` on
 * the returned `SearchResponse` still reflects the true, uncapped match
 * count, so the UI can say "showing 20 of 4,213 events". */
const MAX_RESULTS_PER_GROUP = 20;

/** True when the query carries no usable search intent at all (no free
 * text, no recognized operators, no active filters) — the "No query"
 * empty state (ticket "14. EMPTY STATES") should show instead of ever
 * calling `search()`. Exported so `searchStore.ts`/`GlobalSearch.tsx`
 * can check this without re-implementing the same "is everything at its
 * default" logic. */
export function hasSearchIntent(rawQuery: string, filters: SearchFilters): boolean {
  const parsed = parseAdvancedQuery(rawQuery);
  const hasOperator =
    parsed.eventId !== null ||
    parsed.provider !== null ||
    parsed.computer !== null ||
    parsed.level !== null ||
    parsed.severity !== null ||
    parsed.mitreTechnique !== null ||
    parsed.type !== null ||
    parsed.bookmarkedOnly !== null ||
    parsed.notesOnly !== null ||
    parsed.minConfidence !== null ||
    parsed.minRisk !== null;
  const hasFreeText = parsed.freeText.trim().length > 0;
  const hasFilter =
    filters.type !== "all" ||
    filters.provider !== null ||
    filters.computer !== null ||
    filters.level !== null ||
    filters.severity !== null ||
    filters.mitreTechnique !== null ||
    filters.bookmarkedOnly ||
    filters.notesOnly ||
    filters.minConfidence !== null ||
    filters.minRisk !== null;
  return hasFreeText || hasOperator || hasFilter;
}

/** Merges the search-box's inline `key:value` operators with the
 * `SearchFilters` panel state — a per-field operator, when present,
 * takes precedence over the panel's own value for that same field (an
 * investigator typing `provider:X` mid-query is expressing more specific,
 * more recent intent than whatever the panel happened to be set to), but
 * every OTHER field still comes from the panel. Both sources still
 * combine with AND semantics overall — this only decides which single
 * source wins when both name the same field, never widens anything. */
function mergeFiltersWithQuery(
  filters: SearchFilters,
  parsed: ReturnType<typeof parseAdvancedQuery>,
): SearchFilters {
  return {
    type: parsed.type ?? filters.type,
    provider: parsed.provider ?? filters.provider,
    computer: parsed.computer ?? filters.computer,
    level: parsed.level ?? filters.level,
    severity: parsed.severity ?? filters.severity,
    mitreTechnique: parsed.mitreTechnique ?? filters.mitreTechnique,
    bookmarkedOnly: parsed.bookmarkedOnly ?? filters.bookmarkedOnly,
    notesOnly: parsed.notesOnly ?? filters.notesOnly,
    minConfidence: parsed.minConfidence ?? filters.minConfidence,
    minRisk: parsed.minRisk ?? filters.minRisk,
  };
}

function matchesFilters(entry: IndexedEntry, filters: SearchFilters, index: SearchIndex): boolean {
  const { result } = entry;

  if (filters.type !== "all" && result.type !== filters.type) return false;
  if (filters.provider !== null && result.provider !== filters.provider) return false;
  if (filters.computer !== null && result.computer !== filters.computer) return false;
  if (filters.level !== null && result.level !== filters.level) return false;
  if (filters.severity !== null && result.severity !== filters.severity) return false;
  if (filters.mitreTechnique !== null) {
    if (!result.techniqueId || result.techniqueId.toUpperCase() !== filters.mitreTechnique.toUpperCase()) {
      return false;
    }
  }
  if (filters.bookmarkedOnly) {
    const isBookmarked = Boolean(result.sourceEventId && index.bookmarkedEventIds.has(result.sourceEventId));
    if (!isBookmarked) return false;
  }
  if (filters.notesOnly) {
    const hasNote =
      result.type === "note" || Boolean(result.sourceEventId && index.notedEventIds.has(result.sourceEventId));
    if (!hasNote) return false;
  }
  // Phase 5.13 — Detection Engine 2.0. A result with no confidence/risk
  // concept at all (anything but an enriched `ioc` result) fails a `min*`
  // filter rather than passing it vacuously — "confidence:high" should
  // narrow to matching IOC findings only, not silently include every
  // event/note/case alongside them.
  if (filters.minConfidence !== null) {
    if (result.confidence === undefined || result.confidence < filters.minConfidence) return false;
  }
  if (filters.minRisk !== null) {
    if (result.riskScore === undefined || result.riskScore < filters.minRisk) return false;
  }

  return true;
}

/** Gathers every entry an eventid: operator or a bare-integer free-text
 * query should surface, directly from the index's O(1) `byEventId` map —
 * never a scan. */
function collectExactEventIdCandidates(index: SearchIndex, eventId: number | null): IndexedEntry[] {
  if (eventId === null) return [];
  return index.byEventId.get(eventId) ?? [];
}

function collectExactTechniqueCandidates(index: SearchIndex, techniqueId: string | null): IndexedEntry[] {
  if (!techniqueId) return [];
  return index.byTechniqueId.get(techniqueId) ?? [];
}

/**
 * Gathers candidate entries for a set of free-text tokens using the
 * inverted `byToken` index: an exact-token bucket lookup per token, plus
 * a small prefix/substring fallback over the index's *token vocabulary*
 * (`byToken.keys()` — bounded by the number of distinct words this case
 * ever produces, not the number of events) so a partial word like "power"
 * still surfaces entries tokenized as "powershell". Every bucket touched
 * is a set of entries that already contain that token — this function
 * never inspects an entry that doesn't share at least one token with the
 * query.
 */
function collectTokenCandidates(index: SearchIndex, tokens: string[]): Set<IndexedEntry> {
  const candidates = new Set<IndexedEntry>();
  if (tokens.length === 0) return candidates;

  for (const token of tokens) {
    const exact = index.byToken.get(token);
    if (exact) {
      for (const entry of exact) candidates.add(entry);
    }
  }

  // Prefix/substring fallback — only runs for tokens that found zero exact
  // bucket matches (a whole-word hit already covers those entries), and
  // only scans the vocabulary (unique token strings), not the entries.
  for (const token of tokens) {
    if (index.byToken.has(token)) continue;
    if (token.length < 2) continue; // too short to usefully prefix-match
    for (const [vocabToken, bucket] of index.byToken) {
      if (vocabToken.startsWith(token) || vocabToken.includes(token)) {
        for (const entry of bucket) candidates.add(entry);
      }
    }
  }

  return candidates;
}

interface ScoredEntry {
  entry: IndexedEntry;
  score: number;
  matchedFields: string[];
}

function groupAndCap(scored: ScoredEntry[]): {
  groups: SearchResultGroupData[];
  totalCount: number;
} {
  const byType = new Map<SearchResultType, ScoredEntry[]>();
  for (const scoredEntry of scored) {
    const type = scoredEntry.entry.result.type;
    const bucket = byType.get(type);
    if (bucket) bucket.push(scoredEntry);
    else byType.set(type, [scoredEntry]);
  }

  const groups: SearchResultGroupData[] = [];
  for (const type of SEARCH_RESULT_TYPE_ORDER) {
    const bucket = byType.get(type);
    if (!bucket || bucket.length === 0) continue;
    groups.push({
      type,
      results: bucket
        .slice(0, MAX_RESULTS_PER_GROUP)
        .map(({ entry, score, matchedFields }) => ({ ...entry.result, score, matchedFields })),
    });
  }

  return { groups, totalCount: scored.length };
}

/**
 * Executes one search against an already-built index. Never throws: an
 * empty index, an entirely-unrecognized query, or a filter combination
 * that matches nothing all just produce a `SearchResponse` with empty
 * `groups` and `totalCount: 0` rather than an error — the same
 * "never throw on missing/empty data" contract every other `lib/*` module
 * in this project follows (ticket "22. CORRECTNESS TESTS — invalid query
 * syntax / empty investigation must not throw").
 */
export function search(index: SearchIndex, rawQuery: string, filters: SearchFilters): SearchResponse {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  const parsed = parseAdvancedQuery(rawQuery);
  const effectiveFilters = mergeFiltersWithQuery(filters, parsed);

  const freeTextTokens = tokenizeSearchQuery(parsed.freeText);
  const rawQueryLower = parsed.freeText.trim().toLowerCase();

  const wholeQueryEventId = parsed.eventId ?? detectExactEventId(rawQueryLower);
  const wholeQueryTechniqueId = detectExactTechniqueId(rawQueryLower);

  let candidates: Set<IndexedEntry>;
  if (freeTextTokens.length > 0 || wholeQueryEventId !== null || wholeQueryTechniqueId !== null) {
    candidates = collectTokenCandidates(index, freeTextTokens);
    for (const entry of collectExactEventIdCandidates(index, wholeQueryEventId)) candidates.add(entry);
    for (const entry of collectExactTechniqueCandidates(index, wholeQueryTechniqueId)) candidates.add(entry);
  } else {
    // Filters-only browse (no free text, no exact-id/technique query) —
    // the one intentional full pass over the index; see this module's
    // own doc comment above.
    candidates = new Set(index.entries);
  }

  const rankingContext: RankingContext = {
    rawQueryLower,
    queryTokens: freeTextTokens,
    exactEventId: wholeQueryEventId,
    exactTechniqueId: wholeQueryTechniqueId,
    latestTimestampMs: index.latestTimestampMs,
  };

  const scored: ScoredEntry[] = [];
  for (const entry of candidates) {
    if (!matchesFilters(entry, effectiveFilters, index)) continue;
    scored.push({
      entry,
      score: scoreEntry(entry, rankingContext),
      matchedFields: computeMatchedFields(entry, rankingContext),
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.entry.timestampMs ?? 0;
    const bTime = b.entry.timestampMs ?? 0;
    return bTime - aTime;
  });

  const { groups, totalCount } = groupAndCap(scored);

  const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    query: rawQuery,
    freeText: parsed.freeText,
    filters: effectiveFilters,
    groups,
    totalCount,
    durationMs: finishedAt - startedAt,
  };
}
