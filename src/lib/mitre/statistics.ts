/**
 * MITRE ATT&CK Intelligence Dashboard — statistics & presentation-time
 * derivations (Sprint 5.9.1).
 *
 * Pure, framework-free: no React, no recharts. Everything here is a plain
 * function over an already-built `MitreAggregation` (see aggregation.ts) —
 * no re-scan of `iocFindings`, matching that module's single-pass
 * contract. Chart-data builders are cheap presentation-time slices, safe
 * to call more than once without any extra aggregation cost, mirroring
 * `lib/analytics/aggregation.ts#topN`'s same "sort/slice is not a re-scan"
 * precedent.
 */
import type { DetectionFinding } from "@/lib/detection/types";
import { MITRE_TACTICS, MITRE_TECHNIQUES, getKnownTechniqueIds, type MitreTactic } from "./mapping";
import type {
  MitreAdvancedStats,
  MitreAggregation,
  MitreAverageSeverity,
  MitreChartDatum,
  MitreCoverageStats,
  MitreFilters,
  MitreHeatmapFilters,
  MitreTacticCoverage,
  MitreTechniqueSummary,
} from "./types";

/** Sprint 5.9.3 — the one severity-weighting scale this module uses
 * everywhere severity needs to become a number: heatmap intensity tiering,
 * per-tactic/per-technique risk scores, the severity threshold comparison
 * in `applyHeatmapFilters`, and `computeAdvancedMitreStats`'s average
 * severity. Exported so components that need the same ordering (e.g. a
 * severity `<select>`'s option order) can stay consistent with it, but
 * kept as a plain rank rather than duplicating `SEVERITY_LABEL`'s display
 * strings. */
export const SEVERITY_RANK: Record<DetectionFinding["severity"], number> = {
  critical: 3,
  warning: 2,
  informational: 1,
};

/** Inverse-of-`SEVERITY_RANK` lookup (1/2/3 -> severity), used only to map
 * `computeAdvancedMitreStats`'s rounded average severity score back to a
 * display label. Not exported — `SEVERITY_LABEL`/`SEVERITY_BY_LABEL` below
 * already cover every other direction this module needs; this one's
 * specific to the rounded-integer-score case. */
const SEVERITY_LABEL_TO_VALUE: Record<number, DetectionFinding["severity"]> = {
  1: "informational",
  2: "warning",
  3: "critical",
};

/**
 * Coverage % = techniques observed / techniques known by mapping, per this
 * sprint's own definition. `totalTechniquesKnown` is fixed (13, currently)
 * — not derived from the case — so this reflects how much of the
 * detection engine's *possible* MITRE coverage this specific case actually
 * triggered.
 */
export function computeCoverageStats(aggregation: MitreAggregation): MitreCoverageStats {
  const totalTechniquesKnown = getKnownTechniqueIds().length;
  const totalTechniquesObserved = aggregation.techniques.length;
  const uniqueTacticsObserved = new Set(aggregation.techniques.map((t) => t.tactic)).size;
  const criticalFindingsCount = aggregation.techniques.reduce(
    (sum, t) => sum + t.severityCounts.critical,
    0,
  );
  const coveragePercent =
    totalTechniquesKnown === 0
      ? 0
      : Math.round((totalTechniquesObserved / totalTechniquesKnown) * 1000) / 10;

  return {
    totalTechniquesObserved,
    totalTechniquesKnown,
    uniqueTacticsObserved,
    iocFindingsCount: aggregation.totalFindings,
    criticalFindingsCount,
    coveragePercent,
  };
}

/** Tactic Distribution chart data — one bar per tactic with at least one
 * observed technique, sorted by finding count descending. */
export function buildTacticChartData(aggregation: MitreAggregation): MitreChartDatum[] {
  return aggregation.tacticGroups
    .filter((group) => group.findingCount > 0)
    .map((group) => ({ label: group.tactic, value: group.findingCount }))
    .sort((a, b) => b.value - a.value);
}

/** Technique Distribution chart data — top techniques by finding count.
 * `aggregation.techniques` is already sorted descending, so this is a
 * plain slice, not a re-sort. */
export function buildTechniqueChartData(aggregation: MitreAggregation, limit = 10): MitreChartDatum[] {
  return aggregation.techniques.slice(0, limit).map((t) => ({ label: t.id, value: t.findingCount }));
}

/** Exported (Sprint 5.9.2) so `MitreAttackPage`/`MitreSeverityDistribution`
 * can reuse this exact value->label mapping (and its inverse,
 * `SEVERITY_BY_LABEL`, below) instead of each declaring their own copy —
 * keeping the mapping in this pure `lib/*` module also avoids the
 * `react-refresh/only-export-components` warning a component file gets for
 * exporting a plain constant alongside its component. */
export const SEVERITY_LABEL: Record<DetectionFinding["severity"], string> = {
  critical: "Critical",
  warning: "Warning",
  informational: "Informational",
};

/** Inverse of `SEVERITY_LABEL` — a chart's label ("Critical") back to the
 * `DetectionFinding["severity"]` value it represents. */
export const SEVERITY_BY_LABEL: Record<string, DetectionFinding["severity"]> = {
  Critical: "critical",
  Warning: "warning",
  Informational: "informational",
};

/** Severity Distribution chart data — severity breakdown across every
 * MITRE-mapped finding (i.e. excluding `unmappedFindingCount`, which by
 * definition has no technique/tactic to attribute it to). */
export function buildSeverityChartData(aggregation: MitreAggregation): MitreChartDatum[] {
  const totals: Record<DetectionFinding["severity"], number> = {
    critical: 0,
    warning: 0,
    informational: 0,
  };
  for (const technique of aggregation.techniques) {
    totals.critical += technique.severityCounts.critical;
    totals.warning += technique.severityCounts.warning;
    totals.informational += technique.severityCounts.informational;
  }
  return (Object.keys(totals) as Array<DetectionFinding["severity"]>)
    .map((severity) => ({ label: SEVERITY_LABEL[severity], value: totals[severity] }))
    .filter((d) => d.value > 0);
}

/**
 * Sprint 5.9.2 — Cross Filtering. These three `*FromTechniques` builders
 * mirror `buildTacticChartData`/`buildTechniqueChartData`/
 * `buildSeverityChartData` exactly, but take an arbitrary technique list
 * instead of a full `MitreAggregation`, so every chart can be rebuilt from
 * whatever `filterMitreTechniques` currently returns (search, tactic,
 * severity, technique-selection, and the two Advanced Filters toggles all
 * flow through the same filtered list). This is *not* a rewrite of the
 * original three — those stay exactly as Sprint 5.9.1 left them and are
 * still what `MitreOverviewCards`/`MitreCoverageStatsPanel` use for
 * whole-case totals that intentionally don't move when a filter is
 * applied. Still bounded (<=13 techniques) and still a plain, cheap
 * re-slice of already-aggregated data — no re-scan of `iocFindings`.
 */
export function buildTacticChartDataFromTechniques(
  techniques: readonly MitreTechniqueSummary[],
): MitreChartDatum[] {
  const totals = new Map<MitreTactic, number>();
  for (const technique of techniques) {
    totals.set(technique.tactic, (totals.get(technique.tactic) ?? 0) + technique.findingCount);
  }
  return Array.from(totals.entries())
    .map(([tactic, value]) => ({ label: tactic, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildTechniqueChartDataFromTechniques(
  techniques: readonly MitreTechniqueSummary[],
  limit = 10,
): MitreChartDatum[] {
  return techniques
    .slice()
    .sort((a, b) => b.findingCount - a.findingCount)
    .slice(0, limit)
    .map((t) => ({ label: t.id, value: t.findingCount }));
}

export function buildSeverityChartDataFromTechniques(
  techniques: readonly MitreTechniqueSummary[],
): MitreChartDatum[] {
  const totals: Record<DetectionFinding["severity"], number> = {
    critical: 0,
    warning: 0,
    informational: 0,
  };
  for (const technique of techniques) {
    totals.critical += technique.severityCounts.critical;
    totals.warning += technique.severityCounts.warning;
    totals.informational += technique.severityCounts.informational;
  }
  return (Object.keys(totals) as Array<DetectionFinding["severity"]>)
    .map((severity) => ({ label: SEVERITY_LABEL[severity], value: totals[severity] }))
    .filter((d) => d.value > 0);
}

/** Deduplicated, insertion-ordered list of `EvtxEvent.id`s this technique's
 * findings point at — the same dedup `MitreFindingDrawer.tsx` already did
 * inline for "Affected Events", factored out here so the Technique Table's
 * "Has Events" filter and the drawer agree on exactly what counts as an
 * affected event. Doesn't resolve against the live `events` array itself
 * (this module never touches `events`) — callers cross-reference the
 * returned IDs against their own event set, e.g.
 * `filterMitreTechniques`'s `knownEventIds` parameter below. */
export function getAffectedEventIds(technique: MitreTechniqueSummary): string[] {
  const seen = new Set<string>();
  for (const finding of technique.findings) seen.add(finding.eventId);
  return Array.from(seen);
}

/** Sprint 5.9.3 — which of the four heat colors a cell renders as ("none"
 * for an unobserved/zero-finding cell, otherwise the technique's own
 * `highestSeverity`). A plain re-labeling of `DetectionFinding["severity"]`
 * plus "none" rather than a new severity vocabulary. */
export type HeatmapTier = "none" | DetectionFinding["severity"];

export interface CoverageMatrixCell {
  id: string;
  name: string;
  observed: boolean;
  findingCount: number;
  /** Sprint 5.9.3 — additive. `null` for an unobserved cell. */
  highestSeverity: DetectionFinding["severity"] | null;
  /** Sprint 5.9.3 — additive. Representative recommendation preview (same
   * text `MitreTechniqueSummary.recommendation` carries), `""` when
   * unobserved. The hover popup truncates it further for display; this
   * carries the full text so the component decides how much to show. */
  recommendation: string;
  /** Sprint 5.9.3 — Heatmap Matrix. `"none"` (muted) when unobserved,
   * otherwise mirrors `highestSeverity` — informational/warning/critical
   * map to blue/amber/red per this sprint's color spec. */
  heatTier: HeatmapTier;
  /** Sprint 5.9.3 — 0 (no findings) to 1 (this matrix's single heaviest
   * observed technique by finding count), scaling the heat color's
   * opacity/intensity so a technique with many findings reads visually
   * "hotter" than one with a single finding of the same severity. */
  heatIntensity: number;
}

export interface CoverageMatrixColumn {
  tactic: MitreTactic;
  cells: CoverageMatrixCell[];
  /** Sprint 5.9.3 — Risk Score Overlay. Sum of `findingCount` across every
   * observed cell in this column. */
  findingCount: number;
  /** Sprint 5.9.3 — the highest `highestSeverity` among this column's
   * observed cells, or `null` when the column has none. */
  highestSeverity: DetectionFinding["severity"] | null;
  /** Sprint 5.9.3 — 0-100, this column's severity-weighted finding volume
   * (`SEVERITY_RANK[cell.highestSeverity] * cell.findingCount`, summed)
   * relative to the single riskiest column in this matrix (which scores
   * 100). A presentational, per-column analogue of
   * `MitreAdvancedStats.highestRiskTactic` — that field identifies the one
   * riskiest tactic for a headline callout, this field scores *every*
   * column so each can carry its own badge. */
  riskScore: number;
}

/**
 * Builds the Coverage Matrix's full grid — every *known* technique
 * (`lib/mitre/mapping.ts#MITRE_TECHNIQUES`, not just the ones this case
 * happened to trigger), grouped under its tactic column, each marked
 * observed/unobserved by cross-referencing the aggregation's observed
 * technique list. This is a small, fixed-size derivation (bounded by the
 * known technique count, currently 13) over already-aggregated data, not
 * a re-scan of `iocFindings`.
 *
 * Sprint 5.9.3 upgrades this same function (rather than adding a parallel
 * builder) with the per-cell heat tier/intensity and per-column risk
 * overlay fields the Heatmap Matrix and Risk Score Overlay need — same
 * single bounded pass, just stashing a few more derived fields already
 * available from `observed`/`info` while building each cell, plus one
 * more small (<=14-column) pass afterward to normalize risk scores
 * relative to the matrix's own riskiest column.
 */
export function buildCoverageMatrix(aggregation: MitreAggregation): CoverageMatrixColumn[] {
  const observedById = new Map(aggregation.techniques.map((t) => [t.id, t]));
  const byTactic = new Map<MitreTactic, CoverageMatrixCell[]>();

  // Bounds heat intensity: the busiest observed technique in this matrix
  // renders at full intensity (1), everything else scales relative to it.
  const maxFindingCount = aggregation.techniques.reduce((max, t) => Math.max(max, t.findingCount), 0);

  for (const info of Object.values(MITRE_TECHNIQUES)) {
    const observed = observedById.get(info.id);
    const highestSeverity = observed?.highestSeverity ?? null;
    const cell: CoverageMatrixCell = {
      id: info.id,
      name: info.name,
      observed: Boolean(observed),
      findingCount: observed?.findingCount ?? 0,
      highestSeverity,
      recommendation: observed?.recommendation ?? "",
      heatTier: highestSeverity ?? "none",
      heatIntensity: observed && maxFindingCount > 0 ? observed.findingCount / maxFindingCount : 0,
    };
    const bucket = byTactic.get(info.tactic);
    if (bucket) bucket.push(cell);
    else byTactic.set(info.tactic, [cell]);
  }

  const rawColumns = MITRE_TACTICS.map((tactic) => {
    const cells = byTactic.get(tactic) ?? [];
    let findingCount = 0;
    let highestSeverity: DetectionFinding["severity"] | null = null;
    let rawRiskScore = 0;
    for (const cell of cells) {
      if (!cell.observed || !cell.highestSeverity) continue;
      findingCount += cell.findingCount;
      if (!highestSeverity || SEVERITY_RANK[cell.highestSeverity] > SEVERITY_RANK[highestSeverity]) {
        highestSeverity = cell.highestSeverity;
      }
      rawRiskScore += SEVERITY_RANK[cell.highestSeverity] * cell.findingCount;
    }
    return { tactic, cells, findingCount, highestSeverity, rawRiskScore };
  });

  const maxRawRiskScore = rawColumns.reduce((max, c) => Math.max(max, c.rawRiskScore), 0);

  return rawColumns.map(({ rawRiskScore, ...column }) => ({
    ...column,
    riskScore: maxRawRiskScore === 0 ? 0 : Math.round((rawRiskScore / maxRawRiskScore) * 100),
  }));
}

/**
 * Sprint 5.9.3, Step 5 — Heatmap Filters. Applies `MitreHeatmapFilters` to
 * an already-built matrix (see `buildCoverageMatrix`), returning a new,
 * possibly-smaller grid: `hideEmptyTechniques` drops whole columns with no
 * observed cells; `observedOnly` and `severityThreshold` narrow each
 * surviving column's cell list. Pure and cheap — bounded by the same
 * <=14-column/<=13-cell size the matrix itself is, not a re-derivation of
 * anything `buildCoverageMatrix` already computed.
 */
export function applyHeatmapFilters(
  columns: readonly CoverageMatrixColumn[],
  filters: MitreHeatmapFilters,
): CoverageMatrixColumn[] {
  const requireObserved = filters.observedOnly || filters.severityThreshold !== "all";
  const thresholdRank = filters.severityThreshold !== "all" ? SEVERITY_RANK[filters.severityThreshold] : null;

  const result: CoverageMatrixColumn[] = [];
  for (const column of columns) {
    const cells = column.cells.filter((cell) => {
      if (requireObserved && !cell.observed) return false;
      if (thresholdRank !== null) {
        if (!cell.highestSeverity || SEVERITY_RANK[cell.highestSeverity] < thresholdRank) return false;
      }
      return true;
    });

    if (filters.hideEmptyTechniques && !cells.some((cell) => cell.observed)) continue;

    result.push({ ...column, cells });
  }
  return result;
}

/**
 * Applies the Technique Table / Coverage Matrix / chart cross-filters to an
 * already-aggregated technique list. Pure, single-pass, early-short-circuit
 * — mirrors `lib/eventFilters.ts#filterEvents`'s shape without touching
 * that (protected) module.
 *
 * Sprint 5.9.2 extends this beyond Sprint 5.9.1's search/tactic/severity
 * with: `technique` (the Coverage Matrix / chart / table "selection", see
 * `MitreFilters`'s doc comment), `hasRecommendation` and `hasEvents`
 * (Advanced Filters), and a widened search haystack covering every mapped
 * finding's title/description and the technique's own recommendation, per
 * this sprint's "Search across ... Recommendation, IOC Title, IOC
 * Description, Finding Description" requirement (`DetectionFinding` has
 * one `description` field, which doubles as both "IOC Description" and
 * "Finding Description" in that requirement — there's no second field to
 * search separately). Existing callers that only ever set search/tactic/
 * severity keep working unchanged: every new field defaults to "All"/false
 * in `DEFAULT_MITRE_FILTERS`, so an un-set field never narrows anything.
 *
 * `knownEventIds` is optional so this function still works for any caller
 * that doesn't have the live event set on hand (matching this module's
 * existing "never assume a caller has `events`" stance) — when omitted,
 * `hasEvents` falls back to "this technique has at least one finding",
 * which is `true` for every observed technique by construction, i.e. the
 * filter becomes a no-op rather than throwing or silently misclassifying.
 */
export function filterMitreTechniques(
  techniques: readonly MitreTechniqueSummary[],
  filters: MitreFilters,
  knownEventIds?: ReadonlySet<string>,
): MitreTechniqueSummary[] {
  const needle = filters.search.trim().toLowerCase();
  const hasSearch = needle.length > 0;
  const hasTactic = filters.tactic !== "All";
  const hasSeverity = filters.severity !== "All";
  const hasTechnique = filters.technique !== "All";
  const requireRecommendation = filters.hasRecommendation;
  const requireEvents = filters.hasEvents;

  if (
    !hasSearch &&
    !hasTactic &&
    !hasSeverity &&
    !hasTechnique &&
    !requireRecommendation &&
    !requireEvents
  ) {
    return techniques.slice();
  }

  return techniques.filter((technique) => {
    if (hasTactic && technique.tactic !== filters.tactic) return false;
    if (hasSeverity && technique.highestSeverity !== filters.severity) return false;
    if (hasTechnique && technique.id !== filters.technique) return false;

    if (requireRecommendation && technique.recommendation.trim().length === 0) return false;

    if (requireEvents) {
      const affectedIds = getAffectedEventIds(technique);
      const hasResolvableEvent = knownEventIds
        ? affectedIds.some((id) => knownEventIds.has(id))
        : affectedIds.length > 0;
      if (!hasResolvableEvent) return false;
    }

    if (hasSearch) {
      const findingText = technique.findings.map((f) => `${f.title} ${f.description}`).join(" ");
      const haystack =
        `${technique.id} ${technique.name} ${technique.tactic} ${technique.recommendation} ${findingText}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });
}

/**
 * Sprint 5.9.4 — "Critical Techniques" count for the Dashboard's Threat
 * Score enhancement and the PDF report's MITRE section. A technique's
 * `highestSeverity` is already the max severity across its own findings
 * (see `aggregateMitreFindings`), so this is a plain filter over the
 * already-aggregated technique list — no re-scan of `iocFindings`.
 */
export function countCriticalTechniques(aggregation: MitreAggregation): number {
  return aggregation.techniques.filter((t) => t.highestSeverity === "critical").length;
}

const KNOWN_TECHNIQUE_COUNT_BY_TACTIC: ReadonlyMap<MitreTactic, number> = (() => {
  const counts = new Map<MitreTactic, number>();
  for (const info of Object.values(MITRE_TECHNIQUES)) {
    counts.set(info.tactic, (counts.get(info.tactic) ?? 0) + 1);
  }
  return counts;
})();

/** Critical findings weighted far above raw volume, so a tactic with a
 * single critical finding still outranks one with many informational
 * findings — "risk" here means "severity of what was observed", not just
 * "how much of it". Ties within the same critical-count band fall back to
 * total finding volume. */
function tacticRiskScore(findingCount: number, criticalCount: number): number {
  return criticalCount * 10_000 + findingCount;
}

/**
 * Sprint 5.9.2, Step 8 — Coverage Statistics. Computed once from an
 * already-built `MitreAggregation`, same "no re-scan of `iocFindings`"
 * contract as `computeCoverageStats` above; this is a second, small
 * derivation over the same `tacticGroups`/`techniques` (bounded by 14
 * tactics / 13 techniques), not an additional pass over findings.
 */
export function computeAdvancedMitreStats(aggregation: MitreAggregation): MitreAdvancedStats {
  const byTactic: MitreTacticCoverage[] = aggregation.tacticGroups.map((group) => {
    const totalCount = KNOWN_TECHNIQUE_COUNT_BY_TACTIC.get(group.tactic) ?? 0;
    const observedCount = group.techniques.length;
    const observedPercent = totalCount === 0 ? 0 : Math.round((observedCount / totalCount) * 1000) / 10;
    const unobservedPercent =
      totalCount === 0 ? 0 : Math.round(((totalCount - observedCount) / totalCount) * 1000) / 10;
    return {
      tactic: group.tactic,
      observedCount,
      totalCount,
      findingCount: group.findingCount,
      observedPercent,
      unobservedPercent,
    };
  });

  let highestRiskTactic: MitreTactic | null = null;
  let highestScore = 0;
  for (const group of aggregation.tacticGroups) {
    if (group.findingCount === 0) continue;
    const criticalCount = group.techniques.reduce((sum, t) => sum + t.severityCounts.critical, 0);
    const score = tacticRiskScore(group.findingCount, criticalCount);
    if (highestRiskTactic === null || score > highestScore) {
      highestRiskTactic = group.tactic;
      highestScore = score;
    }
  }

  // Sprint 5.9.3 — highest-risk *technique* (not tactic): severity-weighted
  // finding volume via the shared `SEVERITY_RANK` scale (distinct from
  // `tacticRiskScore`'s own critical-dominant weighting above, which exists
  // specifically to make tie-breaking-by-critical-count easy for the
  // *tactic* ranking — this is a plain, comparable-across-techniques score
  // instead). Ties broken by finding count, then technique ID, so this is
  // fully deterministic for a fixed aggregation.
  let highestRiskTechnique: MitreTechniqueSummary | null = null;
  let highestTechniqueScore = -1;
  for (const technique of aggregation.techniques) {
    if (!technique.highestSeverity) continue;
    const score = SEVERITY_RANK[technique.highestSeverity] * technique.findingCount;
    const better =
      !highestRiskTechnique ||
      score > highestTechniqueScore ||
      (score === highestTechniqueScore &&
        (technique.findingCount > highestRiskTechnique.findingCount ||
          (technique.findingCount === highestRiskTechnique.findingCount &&
            technique.id < highestRiskTechnique.id)));
    if (better) {
      highestRiskTechnique = technique;
      highestTechniqueScore = score;
    }
  }

  // Sprint 5.9.3 — mean severity across every MITRE-mapped finding
  // (weighted sum of `SEVERITY_RANK` over each technique's
  // `severityCounts`, divided by the total mapped-finding count) —
  // per-finding, not per-technique, so a technique with many low-severity
  // findings doesn't get the same weight as one with a single finding.
  let weightedSeveritySum = 0;
  let mappedFindingCount = 0;
  for (const technique of aggregation.techniques) {
    for (const severity of Object.keys(technique.severityCounts) as Array<DetectionFinding["severity"]>) {
      const count = technique.severityCounts[severity];
      weightedSeveritySum += SEVERITY_RANK[severity] * count;
      mappedFindingCount += count;
    }
  }
  const averageSeverity: MitreAverageSeverity =
    mappedFindingCount === 0
      ? { score: 0, label: null }
      : {
          score: Math.round((weightedSeveritySum / mappedFindingCount) * 100) / 100,
          label: SEVERITY_LABEL_TO_VALUE[Math.min(3, Math.max(1, Math.round(weightedSeveritySum / mappedFindingCount)))],
        };

  return {
    byTactic,
    highestRiskTactic,
    mostFrequentTechnique: aggregation.techniques[0] ?? null,
    highestRiskTechnique,
    averageSeverity,
  };
}

/**
 * Sprint 5.9.4 — top N tactics by risk, most-to-least. A standalone
 * function rather than widening `computeAdvancedMitreStats`'s single
 * `highestRiskTactic` field: that field is a headline callout (one
 * winner), while the Investigation Summary sentence below needs a short
 * *ranked list* ("Credential Access and Persistence represent the
 * highest-risk areas"). Deliberately duplicates that function's small
 * critical-count-dominant scoring formula (`criticalCount * 10_000 +
 * findingCount`, the same tie-breaking rationale documented on
 * `tacticRiskScore` above) rather than exporting and reusing that private
 * helper — two ranking call sites sharing one three-token formula doesn't
 * justify widening this module's public surface, and keeps
 * `computeAdvancedMitreStats` itself untouched.
 */
export function getTopRiskTactics(aggregation: MitreAggregation, limit: number): MitreTactic[] {
  return aggregation.tacticGroups
    .filter((group) => group.findingCount > 0)
    .map((group) => {
      const criticalCount = group.techniques.reduce((sum, t) => sum + t.severityCounts.critical, 0);
      return { tactic: group.tactic, score: criticalCount * 10_000 + group.findingCount };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.tactic);
}

/**
 * Sprint 5.9.4 — Investigation Summary's "MITRE Summary" sentence (Step 2
 * of that sprint's ticket), e.g. "Observed 8 ATT&CK techniques across 5
 * tactics. Credential Access and Persistence represent the highest-risk
 * areas." Pure text generation over an already-built `MitreAggregation`,
 * mirroring `backend/investigation-summary.ts`'s own deterministic,
 * template-based narrative style (no LLM, no randomness) without touching
 * that module — this sentence is assembled by the caller (`DashboardPage`)
 * and rendered alongside, not inside, the protected `InvestigationSummary`
 * shape.
 */
export function buildMitreSummarySentence(aggregation: MitreAggregation): string {
  const observedCount = aggregation.techniques.length;
  if (observedCount === 0) {
    return "No ATT&CK techniques were observed in this case.";
  }

  const tacticCount = aggregation.tacticGroups.filter((group) => group.findingCount > 0).length;
  const headline = `Observed ${observedCount} ATT&CK technique${observedCount === 1 ? "" : "s"} across ${tacticCount} tactic${tacticCount === 1 ? "" : "s"}.`;

  const topTactics = getTopRiskTactics(aggregation, 2);
  if (topTactics.length === 0) return headline;
  if (topTactics.length === 1) return `${headline} ${topTactics[0]} represents the highest-risk area.`;
  return `${headline} ${topTactics[0]} and ${topTactics[1]} represent the highest-risk areas.`;
}
