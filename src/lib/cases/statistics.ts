/**
 * Case Management — presentation-time derivations over an already-loaded
 * `CaseMetadata[]` (Phase 5.10).
 *
 * Pure, framework-free — no React, no storage I/O (that's `storage.ts`).
 * Every function here operates on a small, bounded array (the number of
 * cases an analyst has ever saved locally — tens, not millions), so a
 * plain `Array.prototype.sort`/`filter`/`reduce` pass is always cheap
 * enough to re-run on every render rather than needing its own cache.
 */
import type { CaseLibraryStats, CaseMetadata, CaseSortOrder } from "./types";

/**
 * Sorts a case list per the Case Library's four supported orders. Returns
 * a new array — never mutates `cases` — so callers (e.g. a
 * `useMemo`-wrapped selector) can safely pass a store's live array without
 * it being reordered out from under any other consumer.
 */
export function sortCases(cases: readonly CaseMetadata[], order: CaseSortOrder): CaseMetadata[] {
  const sorted = cases.slice();
  switch (order) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "highest-threat":
      return sorted.sort((a, b) => b.threatScore - a.threatScore);
    case "most-events":
      return sorted.sort((a, b) => b.eventCount - a.eventCount);
    default:
      return sorted;
  }
}

/**
 * Case Library search — matches the case's display name, its stable id
 * (the original source filename/merge summary, useful when a case has
 * been renamed to something that no longer mentions the file), or any
 * individual source filename. Case-insensitive substring match, same
 * matching style as every other search box in this app (e.g.
 * `lib/eventFilters.ts`, `lib/mitre/statistics.ts#filterMitreTechniques`)
 * rather than a fuzzy/ranked search — a case library is small enough that
 * a simple substring match is never a discoverability problem.
 */
export function searchCases(cases: readonly CaseMetadata[], query: string): CaseMetadata[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return cases.slice();
  return cases.filter((c) => {
    const haystack = `${c.name} ${c.id} ${c.sourceFiles.join(" ")}`.toLowerCase();
    return haystack.includes(needle);
  });
}

/**
 * Case Library header statistics (Total Cases / Average Threat Score /
 * Total Events / Total Findings) — a single pass over the full case list,
 * not per-card recomputation. `averageThreatScore` rounds to one decimal
 * place, matching `lib/mitre/statistics.ts#computeCoverageStats`'s own
 * rounding convention for percentage-like figures.
 */
export function computeCaseLibraryStats(cases: readonly CaseMetadata[]): CaseLibraryStats {
  if (cases.length === 0) {
    return { totalCases: 0, averageThreatScore: 0, totalEvents: 0, totalFindings: 0 };
  }

  let threatScoreSum = 0;
  let totalEvents = 0;
  let totalFindings = 0;
  for (const c of cases) {
    threatScoreSum += c.threatScore;
    totalEvents += c.eventCount;
    totalFindings += c.findingCount;
  }

  return {
    totalCases: cases.length,
    averageThreatScore: Math.round((threatScoreSum / cases.length) * 10) / 10,
    totalEvents,
    totalFindings,
  };
}

/**
 * Dashboard sidebar's "Recent Cases" (Phase 5.10) — the `limit` most
 * recently *opened* cases (not most recently created/updated), newest
 * first. Reuses `sortCases`' "newest" comparator shape but on
 * `lastOpened` specifically, since "recent" here means "recently viewed
 * by the analyst", not "recently changed".
 */
export function getRecentCases(cases: readonly CaseMetadata[], limit = 5): CaseMetadata[] {
  return cases
    .slice()
    .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
    .slice(0, limit);
}
