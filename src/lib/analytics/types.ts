/**
 * Analytics Dashboard — shared types (Phase 5.6).
 *
 * Pure, framework-free: no React, no recharts, no Zustand. Same contract
 * as every other `lib/*` module in this project.
 */
import type { DetectionFinding } from "@/lib/detection/types";
import type { EventLevel } from "@/types/evidence";

/** Generic {label, value} pair — the shape every bar/pie chart in this
 * feature ultimately renders, regardless of what it was aggregated from. */
export interface ChartDatum {
  label: string;
  value: number;
}

/** One point in the Events Over Time line chart. `bucket` is the raw sort
 * key (an ISO hour or day string); `label` is what's actually displayed. */
export interface TimeSeriesPoint {
  bucket: string;
  label: string;
  count: number;
}

export type TimeGranularity = "hour" | "day";

/**
 * Result of one single-pass scan over the event set (see
 * `aggregation.ts#aggregateEvents`). Intentionally holds `Map`s rather than
 * pre-sorted arrays — sorting/top-N slicing is a cheap, presentation-time
 * concern (`aggregation.ts#topN`) that shouldn't be redone if a caller only
 * needs, say, the raw counts for a different top-N cutoff.
 */
export interface RawAggregation {
  totalEvents: number;
  levelCounts: Map<EventLevel, number>;
  providerCounts: Map<string, number>;
  eventIdCounts: Map<number, number>;
  computerCounts: Map<string, number>;
  hourlyBuckets: Map<string, number>;
  dailyBuckets: Map<string, number>;
  earliestMs: number | null;
  latestMs: number | null;
}

/** Distribution of IOC finding severities (Phase 5.4's `DetectionFinding`
 * severity vocabulary — critical/warning/informational) plus a per-tactic
 * breakdown of MITRE technique coverage, derived from the same array. */
export interface ThreatAggregation {
  severityCounts: Record<DetectionFinding["severity"], number>;
  tacticCounts: Map<string, number>;
  totalFindings: number;
}

/** Small, derived, human-readable insights layered on top of a
 * `RawAggregation` — captions/empty-state copy for `AnalyticsPanel`, not
 * chart data itself. See `statistics.ts`. */
export interface AnalyticsSummary {
  topProvider: ChartDatum | null;
  topComputer: ChartDatum | null;
  busiestBucket: TimeSeriesPoint | null;
  granularity: TimeGranularity;
}
