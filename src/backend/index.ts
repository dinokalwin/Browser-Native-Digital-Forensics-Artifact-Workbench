/**
 * Backend integration boundary — everything the UI needs from "the
 * backend" is exported from this one module, so callers never import
 * from the individual implementation files directly.
 *
 * All five functions are now real, client-side implementations:
 *  - parseEVTX (Phase 6) — browser-native EVTX parsing, see evtx-parser.ts.
 *  - detectSuspicious / generateInvestigationSummary (Phase 7) — rule-based,
 *    deterministic analysis over the parsed events, see
 *    suspicious-detection.ts and investigation-summary.ts.
 *  - exportCSV / exportJSON (Phase 7) — see csv-export.ts / json-export.ts.
 *
 * Nothing here calls a server; everything runs in the browser.
 */
import type { EvtxEvent, SuspiciousFinding } from "@/types/evidence";
import { parseEVTX as parseEVTXImpl } from "./evtx-parser";
import { detectSuspiciousEvents } from "./suspicious-detection";
import { generateSummary } from "./investigation-summary";
import { exportEventsAsCSV } from "./csv-export";
import { exportEventsAsJSON } from "./json-export";

export const parseEVTX = parseEVTXImpl;

export async function detectSuspicious(events: EvtxEvent[]): Promise<SuspiciousFinding[]> {
  return detectSuspiciousEvents(events);
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
