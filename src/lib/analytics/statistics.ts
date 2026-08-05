/**
 * Analytics Dashboard — derived summary statistics (Phase 5.6).
 *
 * Distinct from the top-level `lib/statistics.ts` (case-wide totals/date
 * range/duration, reused as-is and unmodified elsewhere in the app): this
 * module derives small, human-readable insights *from an already-computed
 * `RawAggregation`* (see `aggregation.ts`) — "which provider is busiest",
 * "when did most activity happen" — for `AnalyticsPanel`'s captions and
 * empty-state copy. No event-array scanning happens here; everything is
 * read off the aggregation's pre-built maps.
 */
import type { AnalyticsSummary, RawAggregation, TimeSeriesPoint } from "./types";
import { buildTimeSeries, chooseGranularity, topN } from "./aggregation";

function topOf(counts: Map<string, number>): { label: string; value: number } | null {
  const [top] = topN(counts, 1);
  return top ?? null;
}

function busiestPoint(series: TimeSeriesPoint[]): TimeSeriesPoint | null {
  if (series.length === 0) return null;
  return series.reduce((max, point) => (point.count > max.count ? point : max), series[0]);
}

/** Builds the small caption-level summary `AnalyticsPanel` shows above the
 * chart grid — top provider, top host, busiest time bucket, and which
 * granularity the time chart chose. */
export function summarizeAnalytics(aggregation: RawAggregation): AnalyticsSummary {
  const granularity = chooseGranularity(aggregation.earliestMs, aggregation.latestMs);
  const series = buildTimeSeries(aggregation, granularity);

  return {
    topProvider: topOf(aggregation.providerCounts),
    topComputer: topOf(aggregation.computerCounts),
    busiestBucket: busiestPoint(series),
    granularity,
  };
}
