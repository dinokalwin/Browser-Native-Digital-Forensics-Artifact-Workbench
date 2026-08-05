/**
 * MITRE ATT&CK Intelligence Dashboard — shared types (Sprint 5.9.1).
 *
 * Pure, framework-free: no React, no recharts, no Zustand. Same contract
 * as every other `lib/*` module in this project (see `lib/analytics/types.ts`,
 * `lib/detection/types.ts`).
 */
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreTactic } from "./mapping";

/** Generic {label, value} pair — the shape every chart on this page
 * ultimately renders, matching `lib/analytics/types.ts#ChartDatum`'s
 * convention (kept as a separate local type rather than importing that
 * one, since this module has no other dependency on `lib/analytics`). */
export interface MitreChartDatum {
  label: string;
  value: number;
}

/** One technique actually observed in this case's IOC findings, with
 * every finding that matched it already grouped in. */
export interface MitreTechniqueSummary {
  id: string;
  name: string;
  tactic: MitreTactic;
  description: string;
  findings: DetectionFinding[];
  findingCount: number;
  severityCounts: Record<DetectionFinding["severity"], number>;
  /** Highest-severity finding's severity for this technique, or `null` if
   * (impossibly) it has zero findings — used for the table's Severity
   * column and the coverage matrix badge's tone. */
  highestSeverity: DetectionFinding["severity"] | null;
  /** Recommendation text from this technique's highest-severity finding —
   * one representative recommendation per technique for the table/drawer,
   * rather than repeating every matched finding's own recommendation. */
  recommendation: string;
}

/** All techniques belonging to one tactic — every one of the 14 tactics
 * gets an entry (even with zero observed techniques), so the Coverage
 * Matrix always renders a full, stable set of columns. */
export interface MitreTacticGroup {
  tactic: MitreTactic;
  techniques: MitreTechniqueSummary[];
  findingCount: number;
}

/** Result of one single pass over `iocFindings` (see
 * `aggregation.ts#aggregateMitreFindings`). */
export interface MitreAggregation {
  /** Only techniques with at least one observed finding, sorted by finding
   * count descending. */
  techniques: MitreTechniqueSummary[];
  /** All 14 tactics, in ATT&CK kill-chain order, each listing only the
   * techniques observed under it (empty array for a tactic with none). */
  tacticGroups: MitreTacticGroup[];
  totalFindings: number;
  /** Findings with no `mitreTechnique`, or one this page doesn't have
   * metadata for — excluded from every technique/tactic breakdown above,
   * counted here so that total is never silently lost. */
  unmappedFindingCount: number;
}

export interface MitreCoverageStats {
  totalTechniquesObserved: number;
  totalTechniquesKnown: number;
  uniqueTacticsObserved: number;
  iocFindingsCount: number;
  criticalFindingsCount: number;
  /** `totalTechniquesObserved / totalTechniquesKnown * 100`, rounded to
   * one decimal place. `0` when no techniques are known (never divides by
   * zero). */
  coveragePercent: number;
}

/** Sprint 5.9.2, Step 8 — per-tactic coverage breakdown (one entry per
 * ATT&CK tactic, in kill-chain order, mirroring `MitreTacticGroup`'s "every
 * tactic always present" contract). */
export interface MitreTacticCoverage {
  tactic: MitreTactic;
  observedCount: number;
  totalCount: number;
  findingCount: number;
  /** `observedCount / totalCount * 100`, rounded to one decimal place. `0`
   * when this tactic has zero known techniques (never divides by zero). */
  observedPercent: number;
  /** `100 - observedPercent`, computed independently (not by subtraction)
   * so both percentages round the same way — see
   * `statistics.ts#computeAdvancedMitreStats`. */
  unobservedPercent: number;
}

/** Sprint 5.9.3 — mean severity across every MITRE-mapped finding in the
 * case, weighted by `statistics.ts#SEVERITY_RANK` (critical=3, warning=2,
 * informational=1). `score` is the raw 1.0-3.0 average; `label` is that
 * average rounded to the nearest severity for display (`null` when there
 * are no mapped findings to average). */
export interface MitreAverageSeverity {
  score: number;
  label: DetectionFinding["severity"] | null;
}

/** Sprint 5.9.2, Step 8 — "Coverage Statistics" additions layered on top of
 * `MitreCoverageStats`: per-tactic coverage, the tactic carrying the most
 * risk, and the single most-frequently-observed technique. Computed once
 * from an already-built `MitreAggregation`, same "no re-scan" contract as
 * every other function in this module.
 *
 * Sprint 5.9.3, Step 8 ("Matrix Statistics") adds `highestRiskTechnique`
 * and `averageSeverity` — additive fields on the same struct rather than a
 * second stats type, since both sprints' stats are computed by the same
 * `computeAdvancedMitreStats` pass and consumed by the same
 * `MitreCoverageStatsPanel`. */
export interface MitreAdvancedStats {
  byTactic: MitreTacticCoverage[];
  /** The tactic with the highest risk score (critical findings weighted
   * above total finding volume — see `computeAdvancedMitreStats`), or
   * `null` when no findings are MITRE-mapped. */
  highestRiskTactic: MitreTactic | null;
  /** `aggregation.techniques[0]` (already sorted by finding count
   * descending), or `null` when no techniques were observed. */
  mostFrequentTechnique: MitreTechniqueSummary | null;
  /** Sprint 5.9.3 — the single observed technique with the highest
   * individual risk score (severity-weighted finding count; see
   * `computeAdvancedMitreStats`), distinct from `mostFrequentTechnique`
   * (which only weighs finding count, not severity) — a technique with
   * fewer but more severe findings can outrank a noisier, lower-severity
   * one here even though it wouldn't there. `null` when nothing observed. */
  highestRiskTechnique: MitreTechniqueSummary | null;
  averageSeverity: MitreAverageSeverity;
}

/** Sprint 5.9.3, Step 5 — Heatmap Filters. Distinct from `MitreFilters`
 * above (which drives the Technique Table / charts / Coverage Matrix
 * selection cross-filter): these three toggles control only what the
 * *heatmap grid itself* renders, independent of the Technique Table's own
 * filtered view — narrowing the heatmap to "Critical only" doesn't also
 * narrow the table, and vice versa. Kept as a separate, small controlled
 * object rather than folded into `MitreFilters` so the two concerns (which
 * techniques exist in the analyst's cross-filtered *investigation*, vs.
 * which cells are visually decluttered from the *heatmap display*) can't
 * accidentally conflate. */
export type MitreSeverityThreshold = "all" | "informational" | "warning" | "critical";

export interface MitreHeatmapFilters {
  /** Hide unobserved (empty) technique cells within whatever tactic
   * columns remain visible. */
  observedOnly: boolean;
  /** Minimum severity a cell's `highestSeverity` must meet to stay
   * visible — "Critical only" = "critical", "Warning+" = "warning",
   * "Informational+" = "informational" (i.e. every mapped severity, so
   * functionally "no threshold" beyond requiring the cell be observed),
   * "all" = no severity requirement at all (matches the ticket's fifth,
   * implicit "no filter" state). Setting anything other than "all"
   * implies `observedOnly` for that cell (an unobserved cell has no
   * severity to compare). */
  severityThreshold: MitreSeverityThreshold;
  /** Drop an entire tactic column when it has zero observed techniques —
   * a coarser, column-level declutter distinct from `observedOnly`'s
   * cell-level one. */
  hideEmptyTechniques: boolean;
}

export const DEFAULT_MITRE_HEATMAP_FILTERS: MitreHeatmapFilters = {
  observedOnly: false,
  severityThreshold: "all",
  hideEmptyTechniques: false,
};

/** Technique Table / Coverage Matrix filter state — plain data, matching
 * `lib/eventFilters.ts#InvestigationFilters`'s "controlled filter object"
 * convention used elsewhere in this app.
 *
 * Sprint 5.9.2 — `technique` doubles as this page's single "selection"
 * concept: clicking a technique in the Coverage Matrix, the Technique
 * Distribution chart, or the Technique Table all funnel into the same
 * `technique` field (see `MitreAttackPage.tsx#handleToggleTechnique`),
 * which simultaneously highlights it, filters the table/matrix/charts, and
 * opens the Finding Drawer — there is no separate "selectedTechniqueId"
 * piece of state to keep in sync. */
export interface MitreFilters {
  search: string;
  tactic: MitreTactic | "All";
  severity: DetectionFinding["severity"] | "All";
  /** A technique ID, or "All" when no technique is selected/cross-filtered. */
  technique: string | "All";
  /** Advanced Filters — only techniques whose representative recommendation
   * (see `MitreTechniqueSummary.recommendation`) is non-empty. */
  hasRecommendation: boolean;
  /** Advanced Filters — only techniques with at least one finding whose
   * event is still resolvable in the currently loaded case (see
   * `filterMitreTechniques`'s `knownEventIds` parameter). */
  hasEvents: boolean;
}

export const DEFAULT_MITRE_FILTERS: MitreFilters = {
  search: "",
  tactic: "All",
  severity: "All",
  technique: "All",
  hasRecommendation: false,
  hasEvents: false,
};
