/**
 * Analytics Dashboard — aggregation (Phase 5.6).
 *
 * Pure, framework-free: no React, no recharts. `aggregateEvents` makes
 * exactly one pass over the event array and produces every count every
 * chart needs (level/provider/event-ID/computer counts, plus *both* hourly
 * and daily time buckets) in that single pass — this is what lets a
 * 100k+-event case compute all seven charts' worth of data as one O(n)
 * scan rather than seven independent ones. Building both bucket
 * granularities up front is cheap (two extra Map increments per event) and
 * avoids a second pass once the span-based granularity choice is known.
 */
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type {
  ChartDatum,
  RawAggregation,
  ThreatAggregation,
  TimeGranularity,
  TimeSeriesPoint,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Above a 2-day span, hourly buckets would be too numerous to read on a
 * line chart — fall back to daily. Below it, daily buckets would be too
 * coarse (as few as one or two points). */
const HOUR_TO_DAY_SPAN_MS = 2 * DAY_MS;

function increment<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Hour bucket key, e.g. "2026-01-01T14" — sortable as a plain string. */
function hourBucketKey(date: Date): string {
  return date.toISOString().slice(0, 13);
}

/** Day bucket key, e.g. "2026-01-01" — sortable as a plain string. */
function dayBucketKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Single-pass scan over `events`. Never throws on missing/unparseable
 * timestamps or blank provider/computer fields (bucketed under "Unknown",
 * matching `lib/eventFilters.ts`'s and `lib/statistics.ts`'s existing
 * conventions) — an empty or entirely-invalid event set just produces all-
 * empty maps rather than a crash.
 */
export function aggregateEvents(events: readonly EvtxEvent[]): RawAggregation {
  const levelCounts = new Map<EvtxEvent["level"], number>();
  const providerCounts = new Map<string, number>();
  const eventIdCounts = new Map<number, number>();
  const computerCounts = new Map<string, number>();
  const hourlyBuckets = new Map<string, number>();
  const dailyBuckets = new Map<string, number>();

  let earliestMs: number | null = null;
  let latestMs: number | null = null;

  for (const event of events) {
    increment(levelCounts, event.level);
    increment(providerCounts, event.provider || "Unknown");
    increment(eventIdCounts, event.eventId);
    increment(computerCounts, event.computer || "Unknown");

    if (!event.timestamp) continue;
    const ms = Date.parse(event.timestamp);
    if (Number.isNaN(ms)) continue;

    if (earliestMs === null || ms < earliestMs) earliestMs = ms;
    if (latestMs === null || ms > latestMs) latestMs = ms;

    const date = new Date(ms);
    increment(hourlyBuckets, hourBucketKey(date));
    increment(dailyBuckets, dayBucketKey(date));
  }

  return {
    totalEvents: events.length,
    levelCounts,
    providerCounts,
    eventIdCounts,
    computerCounts,
    hourlyBuckets,
    dailyBuckets,
    earliestMs,
    latestMs,
  };
}

/** Sorts a count map descending by value and returns the top `n` as chart
 * data. A presentation-time slice, not a re-scan of `events` — safe to
 * call more than once (e.g. for different `n`) without any extra cost
 * over the original `aggregateEvents` pass.
 *
 * Generic over the key type (rather than accepting
 * `Map<string, number> | Map<number, number>`) so each call site
 * instantiates it with one concrete key type — a union parameter here
 * makes `Array.from(counts.entries())` unable to pick a single overload,
 * since `[string, number]` and `[number, number]` aren't the same tuple
 * type. */
export function topN<K extends string | number>(counts: Map<K, number>, n: number): ChartDatum[] {
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label: String(label), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Chooses hourly vs. daily granularity from the case's actual time span —
 * short investigations get hour-level resolution, longer ones collapse to
 * days so the line chart stays readable instead of showing thousands of
 * points. */
export function chooseGranularity(earliestMs: number | null, latestMs: number | null): TimeGranularity {
  if (earliestMs === null || latestMs === null) return "day";
  const span = latestMs - earliestMs;
  return span <= HOUR_TO_DAY_SPAN_MS ? "hour" : "day";
}

function formatHourLabel(bucket: string): string {
  // "2026-01-01T14" -> "Jan 1, 14:00"
  const date = new Date(`${bucket}:00:00Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatDayLabel(bucket: string): string {
  // "2026-01-01" -> "Jan 1, 2026"
  const date = new Date(`${bucket}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Builds a chronologically sorted time series from the pre-built bucket
 * map matching the given granularity — no re-scan of `events`. */
export function buildTimeSeries(aggregation: RawAggregation, granularity: TimeGranularity): TimeSeriesPoint[] {
  const buckets = granularity === "hour" ? aggregation.hourlyBuckets : aggregation.dailyBuckets;
  const formatLabel = granularity === "hour" ? formatHourLabel : formatDayLabel;

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, count]) => ({ bucket, label: formatLabel(bucket), count }));
}

/**
 * Technique -> primary tactic lookup for the MITRE ATT&CK Coverage chart,
 * covering exactly the technique IDs the IOC Detection Engine's 14 rules
 * use (src/lib/detection/rules/*.ts, unmodified). This is a small,
 * chart-scoped lookup table, not a general-purpose "MITRE engine" — several
 * of these techniques map to more than one tactic in the full ATT&CK
 * matrix; the one listed here is the tactic this app's detection rule for
 * that technique is actually detecting against.
 */
const TECHNIQUE_TACTIC: Record<string, string> = {
  T1110: "Credential Access",
  "T1136.001": "Persistence",
  T1098: "Persistence",
  "T1059.001": "Execution",
  T1027: "Defense Evasion",
  T1204: "Execution",
  "T1562.001": "Defense Evasion",
  "T1543.003": "Persistence",
  "T1053.005": "Persistence",
  "T1052.001": "Exfiltration",
  "T1070.001": "Defense Evasion",
  "T1021.001": "Lateral Movement",
  "T1546.003": "Persistence",
};

const UNKNOWN_TACTIC = "Unclassified";

/**
 * Severity and MITRE-tactic distribution over the case's IOC findings
 * (Phase 5.4's `iocFindings`, already computed once at file-load time —
 * this function doesn't re-run detection, just tallies its output). One
 * pass over `findings`, which is typically orders of magnitude smaller
 * than the full event set.
 */
export function aggregateThreats(findings: readonly DetectionFinding[]): ThreatAggregation {
  const severityCounts: Record<DetectionFinding["severity"], number> = {
    critical: 0,
    warning: 0,
    informational: 0,
  };
  const tacticCounts = new Map<string, number>();

  for (const finding of findings) {
    severityCounts[finding.severity] += 1;
    const tactic = (finding.mitreTechnique && TECHNIQUE_TACTIC[finding.mitreTechnique]) || UNKNOWN_TACTIC;
    increment(tacticCounts, tactic);
  }

  return { severityCounts, tacticCounts, totalFindings: findings.length };
}
