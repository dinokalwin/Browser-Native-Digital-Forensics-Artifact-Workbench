/**
 * IOC Detection Engine — orchestration (Phase 5.4).
 *
 * `runDetectionEngine` builds one shared `DetectionContext` (one grouping
 * pass over `events` by Windows Event ID, one `byId` map, one chronological
 * sort) and runs every registered rule against that single context, rather
 * than each of the 14 rules independently filtering/sorting `events` from
 * scratch. This is what keeps a full engine pass a small constant multiple
 * of one pass over the event array, not 14 separate ones — the
 * "Single pass where practical / avoid duplicate scanning" requirement.
 */
import type { EvtxEvent, RiskScore, SuspiciousFinding } from "@/types/evidence";
import { computeRiskScore } from "@/backend/risk-score";
import { getAllRules } from "./registry";
import type { DetectionContext, DetectionFinding } from "./types";

function buildContext(events: EvtxEvent[]): DetectionContext {
  const byId = new Map<string, EvtxEvent>();
  const byEventCode = new Map<number, EvtxEvent[]>();

  for (const event of events) {
    byId.set(event.id, event);
    const bucket = byEventCode.get(event.eventId);
    if (bucket) bucket.push(event);
    else byEventCode.set(event.eventId, [event]);
  }

  const chronological = [...events].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    const invalidA = Number.isNaN(ta);
    const invalidB = Number.isNaN(tb);
    if (invalidA && invalidB) return 0;
    if (invalidA) return 1;
    if (invalidB) return -1;
    return ta - tb;
  });

  return { events, byId, byEventCode, chronological };
}

const SEVERITY_RANK: Record<DetectionFinding["severity"], number> = {
  critical: 0,
  warning: 1,
  informational: 2,
};

/**
 * Runs every registered rule once over a single shared `DetectionContext`
 * and returns all findings, most severe first. Pure and synchronous —
 * callers (evidenceStore.ts) decide whether/how to memoize across
 * re-renders; this function itself does no caching, since it's already
 * cheap (one context build + 14 rule passes over precomputed indices) and
 * is only ever invoked once per file load, not on every render.
 */
export function runDetectionEngine(events: EvtxEvent[]): DetectionFinding[] {
  const ctx = buildContext(events);
  const findings = getAllRules().flatMap((rule) => rule.run(ctx));
  return findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Adapts the engine's richer `DetectionFinding[]` back to the existing,
 * narrower `SuspiciousFinding[]` shape (types/evidence.ts) that
 * `lib/report.ts` and `backend/investigation-summary.ts` are already built
 * against — neither needs to change for the new engine to power them.
 */
export function toSuspiciousFindings(findings: DetectionFinding[]): SuspiciousFinding[] {
  return findings.map((f) => ({
    id: f.id,
    eventId: f.eventId,
    title: f.title,
    description: f.description,
    severity: f.severity,
    mitreTechnique: f.mitreTechnique,
  }));
}

/**
 * Case-level Threat Score. Reuses the existing, unmodified severity-weighted
 * model in `backend/risk-score.ts` — the "enhancement" over the old Risk
 * Score is real even though the math is untouched, because it now scores
 * findings from 14 rules instead of the previous 10, including several
 * (Encoded PowerShell, WMI Persistence, New Administrator, Defender
 * Disabled) that specifically target high-confidence attack techniques.
 * Still returns the existing `RiskScore` shape, so `InvestigationSummary`
 * and `lib/report.ts` require no changes.
 */
export function computeThreatScore(findings: DetectionFinding[]): RiskScore {
  return computeRiskScore(toSuspiciousFindings(findings));
}
