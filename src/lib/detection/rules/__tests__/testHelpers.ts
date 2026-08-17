/**
 * Phase 2 — Automated Test Foundation. Shared test-only helpers for the
 * detection-rule test suite. Not imported by any production code.
 *
 * `makeEvent` builds a minimal, valid `EvtxEvent` with sane defaults so
 * each test only has to specify the fields that matter for that scenario.
 * `findingsFor` runs the FULL registered rule set via the real
 * `runDetectionEngine` (never a hand-built single-rule harness) and filters
 * by `ruleId` — this is deliberate: it exercises the actual production
 * wiring (`registry.ts`'s rule list, `engine.ts`'s context building, and
 * the Phase 5.13 enrichment pass) exactly as `evidenceStore.ts` does,
 * rather than testing a rule's `run()` function in isolation against a
 * hand-built `DetectionContext` that could drift from what the engine
 * actually constructs.
 */
import type { EvtxEvent } from "@/types/evidence";
import { runDetectionEngine } from "@/lib/detection/engine";
import type { DetectionFinding } from "@/lib/detection/types";

let idCounter = 0;

const BASE_TIME = Date.UTC(2026, 0, 1, 12, 0, 0); // 2026-01-01T12:00:00Z

export function makeEvent(overrides: Partial<EvtxEvent> = {}): EvtxEvent {
  idCounter += 1;
  return {
    id: `evt-${idCounter}`,
    timestamp: new Date(BASE_TIME).toISOString(),
    eventId: 4624,
    provider: "Microsoft-Windows-Security-Auditing",
    computer: "WORKSTATION1",
    user: "DOMAIN\\jsmith",
    level: "Information",
    channel: "Security",
    message: "",
    ...overrides,
  };
}

/** `baseTimeMs + offsetMinutes`, as an ISO timestamp — the standard way
 * every rule test below expresses "N minutes after the reference time". */
export function atMinute(offsetMinutes: number): string {
  return new Date(BASE_TIME + offsetMinutes * 60_000).toISOString();
}

/** Runs the real detection engine and returns only the findings produced
 * by `ruleId` — every rule test asserts against this, never against
 * `DetectionFinding[]` as a whole, so one rule's test can't accidentally
 * pass because a DIFFERENT rule fired. */
export function findingsFor(ruleId: string, events: EvtxEvent[]): DetectionFinding[] {
  return runDetectionEngine(events).filter((f) => f.ruleId === ruleId);
}
