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
import { enrichFindings } from "./context/contextScoring";

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
 * Runs every registered rule once over a single shared `DetectionContext`,
 * then runs the Phase 5.13 context/confidence enrichment pass
 * (`context/contextScoring.ts#enrichFindings`) over the raw results before
 * returning — every consumer of `runDetectionEngine` (evidenceStore.ts,
 * and transitively the Dashboard/MITRE page/PDF report/Export
 * Center/Search index) gets confidence-aware findings automatically,
 * with no changes needed on their end. Findings are sorted most severe
 * first — unchanged from before this phase; `severity` itself is never
 * touched by enrichment, only the new optional fields are added.
 *
 * Pure and synchronous — callers (evidenceStore.ts) decide whether/how to
 * memoize across re-renders; this function itself does no caching, since
 * it's already cheap (one context build + 14 rule passes over
 * precomputed indices + one enrichment pass, all O(events) or bounded by
 * finding count) and is only ever invoked once per file load, not on
 * every render.
 *
 * `enabledRuleIds` (Phase 5 Item 2 — Configurable Rule Set) is optional
 * and additive: every existing call site (every rule/context test in this
 * project, plus every production caller until this phase) omits it and
 * gets the exact previous behavior — all registered rules run. When
 * provided, it's a pure filter applied to *which rules run at all*
 * (`rule.run(ctx)` is simply never called for an excluded rule, so a
 * disabled rule produces zero findings, not findings that get filtered
 * out afterward) — nothing about context building, an individual rule's
 * own logic, or the enrichment/scoring pass below is altered for the
 * rules that DO run. An id in `enabledRuleIds` that doesn't match any
 * registered rule is silently inert (no matching rule to enable), never
 * an error.
 */
export function runDetectionEngine(
  events: EvtxEvent[],
  enabledRuleIds?: ReadonlySet<string>,
): DetectionFinding[] {
  const ctx = buildContext(events);
  const activeRules = enabledRuleIds
    ? getAllRules().filter((rule) => enabledRuleIds.has(rule.id))
    : getAllRules();
  const rawFindings = activeRules.flatMap((rule) => rule.run(ctx));
  const findings = enrichFindings(rawFindings, ctx);
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
    // Phase 5.13 — carried through so `backend/risk-score.ts#computeRiskScore`
    // (the function that actually produces the Dashboard's Threat Score,
    // via `backend/investigation-summary.ts`) can use confidence-weighted
    // math instead of a naive severity sum, without needing its own copy
    // of the richer `DetectionFinding` shape.
    confidence: f.confidence,
    confidenceLevel: f.confidenceLevel,
    riskScore: f.riskScore,
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
