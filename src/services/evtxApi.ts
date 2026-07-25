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
  detectSuspicious as backendDetectSuspicious,
  generateInvestigationSummary as backendGenerateInvestigationSummary,
  exportCSV as backendExportCSV,
  exportJSON as backendExportJSON,
} from "@/backend";
import type { EvtxEvent, SuspiciousFinding } from "@/types/evidence";

export const parseEVTX = (file: File) => backendParseEVTX(file);

export const detectSuspicious = (events: EvtxEvent[]) =>
  backendDetectSuspicious(events);

export const generateInvestigationSummary = (
  events: EvtxEvent[],
  suspiciousFindings: SuspiciousFinding[],
) => backendGenerateInvestigationSummary(events, suspiciousFindings);

export const exportCSV = (events: EvtxEvent[]) => backendExportCSV(events);

export const exportJSON = (events: EvtxEvent[]) => backendExportJSON(events);
