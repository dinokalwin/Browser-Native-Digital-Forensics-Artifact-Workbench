/**
 * IOC Detection Engine — shared types (Phase 5.4).
 *
 * Pure, framework-free: no React, no Zustand, no jsPDF. Same contract as
 * every other `lib/*` module in this project — plain data in, plain data
 * out, safe to call from a component, a store, or a unit test.
 */
import type { EvtxEvent, SuspicionSeverity } from "@/types/evidence";
import type {
  ConfidenceLevel,
  DetectionContextSummary,
  EvidenceSignal,
} from "./context/contextScoring";

export type { ConfidenceLevel, DetectionContextSummary, EvidenceSignal };

/** Reuses the existing `SuspicionSeverity` union ("critical" | "warning" |
 * "informational") rather than inventing a parallel severity vocabulary —
 * this is exactly what lets `toSuspiciousFindings` (engine.ts) adapt a
 * `DetectionFinding` back to the protected `SuspiciousFinding` shape
 * `lib/report.ts` already consumes without any lossy conversion. */
export type DetectionSeverity = SuspicionSeverity;

/**
 * A single indicator-of-compromise match. Richer than the existing
 * `SuspiciousFinding` (types/evidence.ts) — adds `ruleId`/`ruleName` (which
 * rule produced this) and `recommendation` (what an analyst should do
 * about it), per this phase's "Each Finding Must Include ... Recommendation"
 * requirement. `types/evidence.ts` itself is left untouched; this is a new,
 * separate type so the report generator's existing contract never changes.
 */
export interface DetectionFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  /** FK -> EvtxEvent.id (not the numeric Windows Event ID). */
  eventId: string;
  title: string;
  description: string;
  severity: DetectionSeverity;
  mitreTechnique?: string;
  recommendation: string;

  /**
   * Phase 5.13 — Detection Engine 2.0. Everything below is populated by
   * `context/contextScoring.ts#enrichFindings` (the last step of
   * `engine.ts#runDetectionEngine`), never by an individual rule — every
   * field is optional specifically so this remains a purely additive
   * extension: a finding constructed anywhere that doesn't run through
   * enrichment (a unit test building a bare `DetectionFinding` literal,
   * for instance) is still perfectly valid, it just has no context yet.
   * See that module's doc comment for the full model.
   */
  /** 0-100 — confidence this finding represents a genuine threat, after
   * weighing every contextual evidence signal on top of the rule's base
   * severity. */
  confidence?: number;
  /** Bucketed `confidence` (see `contextScoring.ts#confidenceLevelFor`). */
  confidenceLevel?: ConfidenceLevel;
  /** Currently always equal to `confidence` — this project treats "how
   * risky is this finding" and "how confident are we it's a genuine
   * threat" as the same underlying 0-100 number (see
   * `contextScoring.ts`'s module doc comment for the rationale). Kept as
   * its own field because the ticket names it separately and because a
   * future scoring revision may legitimately want to diverge the two. */
  riskScore?: number;
  /** Every signal (positive and negative) that contributed to `confidence`. */
  evidenceSignals?: EvidenceSignal[];
  /** Compact, display-ready summary of the context this finding was
   * evaluated with. */
  context?: DetectionContextSummary;
}

/**
 * Precomputed indices shared by every rule, built exactly once per
 * `runDetectionEngine` call (see engine.ts) — this is what keeps a 14-rule
 * pass over a large case a small constant multiple of one pass over
 * `events`, rather than 14 independent full scans/sorts.
 */
export interface DetectionContext {
  /** All parsed events for this case, in original order. */
  events: EvtxEvent[];
  /** EvtxEvent.id -> EvtxEvent, for O(1) lookup by a finding's `eventId`. */
  byId: Map<string, EvtxEvent>;
  /** Windows Event ID (EvtxEvent.eventId, e.g. 4625) -> matching events, in
   * original order — the single grouping pass every "does event code X
   * occur" rule needs, computed once instead of once per rule. */
  byEventCode: Map<number, EvtxEvent[]>;
  /** All events sorted ascending by parsed timestamp; events with an
   * unparseable timestamp sort last (stable) rather than being dropped —
   * the single chronological ordering every time-windowed rule needs. */
  chronological: EvtxEvent[];
}

/**
 * One independent detection rule. `run` receives the shared context built
 * once by the engine and returns zero or more findings — a rule never
 * calls another rule or depends on another rule's output, so rules can be
 * added, removed, or reordered in `rules/index.ts` without affecting any
 * other rule's behavior.
 */
export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  run: (ctx: DetectionContext) => DetectionFinding[];
}

let idCounter = 0;

/** Monotonic, human-readable finding id (e.g. "ioc-brute-force-3"). Module-
 * level counter is safe here for the same reason the pre-existing
 * `suspicious-detection.ts` used one: detection runs synchronously, once
 * per file load, never concurrently with itself. */
export function makeFindingId(ruleId: string): string {
  idCounter += 1;
  return `ioc-${ruleId}-${idCounter}`;
}
