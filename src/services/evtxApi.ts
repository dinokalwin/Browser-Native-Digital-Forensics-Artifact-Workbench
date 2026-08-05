/**
 * Thin integration boundary between the UI/store layer and the backend
 * module. Every backend call the frontend makes goes through this file —
 * nothing outside `services/` imports from "@/backend" directly.
 *
 * This keeps the swap-in of the real backend implementation (and any
 * future mocking for tests/storybook) a one-file change. No parsing or
 * detection logic is implemented here; these are pass-through wrappers
 * around the contract declared in `types/backend-api.d.ts`.
 */
import {
  parseEVTX as backendParseEVTX,
  detectIOCs as backendDetectIOCs,
  adaptToSuspiciousFindings as backendAdaptToSuspiciousFindings,
  detectSuspicious as backendDetectSuspicious,
  generateInvestigationSummary as backendGenerateInvestigationSummary,
  exportCSV as backendExportCSV,
  exportJSON as backendExportJSON,
} from "@/backend";
import type { EvtxEvent, SuspiciousFinding } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";

export const parseEVTX = (file: File) => backendParseEVTX(file);

/** Phase 5.4 — the modular IOC Detection Engine's own, richer finding
 * shape. `evidenceStore.ts`'s pipeline calls this once and adapts its
 * result via `adaptToSuspiciousFindings` below rather than calling
 * `detectSuspicious` separately (which would re-run the same engine). */
export const detectIOCs = (events: EvtxEvent[]) => backendDetectIOCs(events);

export const adaptToSuspiciousFindings = (findings: DetectionFinding[]) =>
  backendAdaptToSuspiciousFindings(findings);

export const detectSuspicious = (events: EvtxEvent[]) => backendDetectSuspicious(events);

export const generateInvestigationSummary = (
  events: EvtxEvent[],
  suspiciousFindings: SuspiciousFinding[],
) => backendGenerateInvestigationSummary(events, suspiciousFindings);

export const exportCSV = (events: EvtxEvent[]) => backendExportCSV(events);

export const exportJSON = (events: EvtxEvent[]) => backendExportJSON(events);
