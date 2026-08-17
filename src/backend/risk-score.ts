/**
 * Deterministic risk scoring for a case, derived from its suspicious
 * findings. Pure function, no I/O — easy to unit test and to swap for a
 * more sophisticated model later without touching callers.
 *
 * Phase 5.13 — Detection Engine 2.0 redesign (ticket section 14: "Do NOT
 * simply count findings ... Use finding risk score x confidence x
 * correlation strength instead. Deduplicate repeated identical low-
 * confidence findings where appropriate."). The `RiskScore`/`RiskLevel`
 * TYPES are completely unchanged (`{ score: number, level: RiskLevel }`,
 * still the existing 4-value `RiskLevel` union) — every consumer
 * (`RiskScoreCard`, `CaseMetadata.threatLevel`/`threatScore`, the PDF
 * report, `InvestigationSummary`) keeps working with zero changes. Only
 * the ALGORITHM inside `computeRiskScore` changes.
 *
 * Old model: a flat per-severity weight summed across every finding,
 * clamped at 100 — meant ~12 "warning"-severity findings alone saturated
 * the score to 100 regardless of whether any of them were actually
 * suspicious. This is exactly the "System.evtx: 225 findings, many
 * legitimate Windows Service Installation events, Threat Score 100"
 * problem the ticket opens with.
 *
 * New model, in two steps:
 *
 *  1. Per-finding contribution is scaled by that finding's OWN confidence
 *     (`riskScore`/`confidence`, 0-100 — see
 *     `lib/detection/context/contextScoring.ts`) against a per-severity
 *     CAP (`SEVERITY_CONTRIBUTION_CAP`, the old flat weights repurposed as
 *     "the most a single finding of this severity can contribute"): a
 *     warning-severity finding at 10/100 confidence contributes
 *     `9 * 0.10 = 0.9` points, not a flat 9. A finding with no confidence
 *     data at all (any caller not going through the Phase 5.13 enrichment
 *     pipeline) falls back to the OLD flat weight — this keeps the
 *     function itself backward-compatible for any hypothetical caller
 *     that still passes bare `SuspiciousFinding[]`.
 *  2. Findings are grouped by `${title}:${confidenceLevel ?? severity}` —
 *     `title` is a stable, already-constant string per rule (every rule in
 *     `lib/detection/rules/*.ts` uses one fixed title string for all of
 *     its findings), so this reliably identifies "the same kind of
 *     finding, at roughly the same confidence" without needing a new
 *     field. Each group's total contribution is
 *     `averageContribution x effectiveCount`, where
 *     `effectiveCount = 1` for a lone finding and
 *     `effectiveCount = 1 + log2(count)` for a repeated group — this is
 *     the "deduplicate repeated identical low-confidence findings"
 *     requirement: 200 near-identical low-confidence findings contribute
 *     roughly `1 + log2(200) ≈ 8.6` finding-equivalents' worth of points,
 *     not 200. A cluster of genuinely distinct HIGH-confidence findings is
 *     completely unaffected by this (each is its own group of size 1).
 *
 * `LEVEL_THRESHOLDS` is raised from the old 75/45/15 to 80/60/40 (ticket
 * section 15's 5-category breakpoints, with "Minimal" and "Low" collapsed
 * into the existing `RiskLevel`'s single "low" — there is no "minimal"
 * level in the unchanged type) precisely because scores are now generally
 * lower for noisy-but-benign cases: keeping the old, lower thresholds
 * would have let residual noise still reach "high"/"critical" even after
 * the per-finding scaling above.
 */
import type { RiskLevel, RiskScore, SuspiciousFinding } from "@/types/evidence";

/** The most a single finding of this severity can contribute to the case
 * score — same numbers the old flat-weight model used, now a CAP that
 * confidence scales down from, rather than a flat addition. */
const SEVERITY_CONTRIBUTION_CAP: Record<SuspiciousFinding["severity"], number> = {
  critical: 22,
  warning: 9,
  informational: 2,
};

const LEVEL_THRESHOLDS: Array<{ min: number; level: RiskLevel }> = [
  { min: 80, level: "critical" },
  { min: 60, level: "high" },
  { min: 40, level: "medium" },
  { min: 0, level: "low" },
];

/** This finding's own contribution to the case score, before dedup
 * grouping — confidence-scaled when available, the old flat cap
 * otherwise. */
function contributionOf(finding: SuspiciousFinding): number {
  const cap = SEVERITY_CONTRIBUTION_CAP[finding.severity];
  if (typeof finding.riskScore !== "number") return cap;
  const confidenceFraction = Math.max(0, Math.min(100, finding.riskScore)) / 100;
  return cap * confidenceFraction;
}

function dedupGroupKey(finding: SuspiciousFinding): string {
  return `${finding.title}:${finding.confidenceLevel ?? finding.severity}`;
}

export function computeRiskScore(findings: SuspiciousFinding[]): RiskScore {
  if (findings.length === 0) return { score: 0, level: "low" };

  const groups = new Map<string, SuspiciousFinding[]>();
  for (const finding of findings) {
    const key = dedupGroupKey(finding);
    const bucket = groups.get(key);
    if (bucket) bucket.push(finding);
    else groups.set(key, [finding]);
  }

  let total = 0;
  for (const group of groups.values()) {
    const averageContribution = group.reduce((sum, f) => sum + contributionOf(f), 0) / group.length;
    const effectiveCount = group.length === 1 ? 1 : 1 + Math.log2(group.length);
    total += averageContribution * effectiveCount;
  }

  const score = Math.round(Math.max(0, Math.min(100, total)));
  const level = LEVEL_THRESHOLDS.find((t) => score >= t.min)?.level ?? "low";
  return { score, level };
}
