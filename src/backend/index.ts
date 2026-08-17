/**
 * Backend integration boundary — everything the UI needs from "the
 * backend" is exported from this one module, so callers never import
 * from the individual implementation files directly.
 *
 * All five functions are now real, client-side implementations:
 *  - parseEVTX (Phase 6) — browser-native EVTX parsing, see evtx-parser.ts.
 *  - detectIOCs (Phase 5.4) — the modular IOC Detection Engine, see
 *    src/lib/detection/. detectSuspicious/generateInvestigationSummary
 *    (Phase 7) are adapted views over the same engine run — see the doc
 *    comments below.
 *  - exportCSV / exportJSON (Phase 7) — see csv-export.ts / json-export.ts.
 *
 * Nothing here calls a server; everything runs in the browser.
 */
import type { EvtxEvent, SuspiciousFinding } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import { runDetectionEngine, toSuspiciousFindings } from "@/lib/detection/engine";
import { parseEVTX as parseEVTXImpl } from "./evtx-parser";
import { generateSummary } from "./investigation-summary";
import { exportEventsAsCSV } from "./csv-export";
import { exportEventsAsJSON } from "./json-export";

export const parseEVTX = parseEVTXImpl;

/**
 * Runs the modular IOC Detection Engine (src/lib/detection/) once over the
 * parsed events and returns its native, richer finding shape — title,
 * description, severity, affected event, MITRE technique, and a
 * recommendation for each match. This is what powers the Dashboard's IOC
 * panel, the Timeline's IOC icons, and the Event Drawer's IOC section.
 *
 * `evidenceStore.ts` calls this exactly once per file load and derives
 * `suspiciousFindings` from its result via `toSuspiciousFindings` below,
 * rather than also calling `detectSuspicious` separately — that would run
 * the engine twice over the same events for no reason.
 *
 * `enabledRuleIds` (Phase 5 Item 2 — Configurable Rule Set) is a pure
 * pass-through to `runDetectionEngine` — see that function's doc comment.
 * Optional so this remains backward-compatible for any caller (including
 * `detectSuspicious` below) that doesn't have a configuration to apply.
 */
export function detectIOCs(
  events: EvtxEvent[],
  enabledRuleIds?: ReadonlySet<string>,
): DetectionFinding[] {
  return runDetectionEngine(events, enabledRuleIds);
}

/**
 * Adapts a `detectIOCs` result to the existing, narrower `SuspiciousFinding`
 * shape that `generateInvestigationSummary` below (and `lib/report.ts`,
 * unmodified) are already built against.
 */
export function adaptToSuspiciousFindings(findings: DetectionFinding[]): SuspiciousFinding[] {
  return toSuspiciousFindings(findings);
}

/**
 * Backward-compatible entry point kept for any caller that only needs the
 * narrower `SuspiciousFinding` shape and doesn't already have a
 * `detectIOCs` result to adapt. Not on the live `evidenceStore.loadFile`
 * pipeline (see `evtxApi.ts`) — that path calls `detectIOCs` once and
 * adapts it, so the engine never runs twice for one file load.
 */
export async function detectSuspicious(events: EvtxEvent[]): Promise<SuspiciousFinding[]> {
  return toSuspiciousFindings(runDetectionEngine(events));
}

export async function generateInvestigationSummary(
  events: EvtxEvent[],
  suspiciousFindings: SuspiciousFinding[],
) {
  return generateSummary(events, suspiciousFindings);
}

export function exportCSV(events: EvtxEvent[]): Blob {
  return exportEventsAsCSV(events);
}

export function exportJSON(events: EvtxEvent[]): Blob {
  return exportEventsAsJSON(events);
}
