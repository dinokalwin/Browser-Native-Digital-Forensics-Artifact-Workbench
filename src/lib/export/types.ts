/**
 * Export Center — shared types (Phase 5.11).
 *
 * Pure data only, no React/Zustand/DOM I/O — mirrors every other feature's
 * `types.ts` in this project (e.g. `lib/cases/types.ts`, `lib/mitre/types.ts`).
 */
import type { RiskLevel } from "@/types/evidence";

export type ExportFormat = "pdf" | "csv" | "json" | "zip";

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  pdf: "PDF",
  csv: "CSV",
  json: "JSON",
  zip: "ZIP",
};

/** One card's worth of identity — matches this phase's ticket "4. EXPORT
 * TYPES" list, with the three multi-format rows (Evidence / IOC Findings /
 * MITRE ATT&CK) collapsed into one card each rather than two, using
 * `ExportFormatSelector` to pick which of `formats` a click produces. */
export type ExportKind =
  | "report"
  | "evidence"
  | "timeline"
  | "iocs"
  | "mitre"
  | "notes"
  | "bookmarks"
  | "bundle";

export interface ExportDefinition {
  id: ExportKind;
  title: string;
  description: string;
  /** Every format this export can be produced in — one entry for a
   * single-format export (Report=PDF, Timeline=CSV, Notes=JSON,
   * Bookmarks=JSON, Bundle=ZIP), two for the three multi-format data
   * exports (Evidence, IOC Findings, MITRE ATT&CK). The first entry is
   * each card's default selected format. */
  formats: ExportFormat[];
}

/** Static card catalog — presentation strings live here (not duplicated in
 * `ExportCenter.tsx`) so the list of what this Center offers is defined in
 * exactly one place, same as `CASE_SORT_LABEL` living in `lib/cases/types.ts`
 * rather than inline in a component. */
export const EXPORT_DEFINITIONS: ExportDefinition[] = [
  {
    id: "report",
    title: "Investigation Report",
    description: "The full narrative report — executive summary, statistics, findings, and MITRE coverage.",
    formats: ["pdf"],
  },
  {
    id: "evidence",
    title: "Evidence",
    description: "Every parsed event in this case, in original field order.",
    formats: ["csv", "json"],
  },
  {
    id: "timeline",
    title: "Timeline",
    description: "Every event in chronological order, one row per event.",
    formats: ["csv"],
  },
  {
    id: "iocs",
    title: "IOC Findings",
    description: "Every indicator-of-compromise match from the Detection Engine, with severity and recommendations.",
    formats: ["csv", "json"],
  },
  {
    id: "mitre",
    title: "MITRE ATT&CK",
    description: "Every technique observed in this case, grouped by tactic.",
    formats: ["csv", "json"],
  },
  {
    id: "notes",
    title: "Investigator Notes",
    description: "The case-wide note and every per-event note recorded in this case.",
    formats: ["json"],
  },
  {
    id: "bookmarks",
    title: "Bookmarks",
    description: "Every bookmarked event id in this case.",
    formats: ["json"],
  },
  {
    id: "bundle",
    title: "Complete Investigation Bundle",
    description: "Everything above, packaged into one ZIP archive for handoff or archival.",
    formats: ["zip"],
  },
];

export type ExportStage = "idle" | "preparing" | "generating" | "packaging" | "downloading" | "completed" | "failed";

export interface ExportStatus {
  stage: ExportStage;
  error: string | null;
}

export const IDLE_EXPORT_STATUS: ExportStatus = { stage: "idle", error: null };

/** Stages between "the investigator clicked Export" and "the file finished
 * downloading (or failed)" — used by both `ExportCard.tsx` (disable its own
 * button) and `ExportCenter.tsx` ("Export Everything" reads every card's
 * status to decide whether *any* export is currently in flight). Kept here
 * rather than co-exported from `ExportCard.tsx` itself so that file stays
 * a single component export, avoiding the same `react-refresh/only-export-
 * components` warning `CASE_THREAT_LABEL`'s doc comment (`lib/cases/types.ts`)
 * already explains avoiding. */
export function isExportBusy(status: ExportStatus): boolean {
  return (
    status.stage === "preparing" ||
    status.stage === "generating" ||
    status.stage === "packaging" ||
    status.stage === "downloading"
  );
}

/** Structured JSON metadata header (ticket "7. JSON") — prepended to every
 * JSON payload this Center produces so a file opened outside the app is
 * still self-describing. */
export interface ExportMetadataHeader {
  caseId: string;
  caseName: string;
  generatedAt: string; // ISO 8601
  sourceFiles: string[];
  eventCount: number;
}

/** "10. Manifest" — one JSON document summarizing the whole case, written
 * to `manifest.json` at the root of the ZIP bundle (and available on its
 * own as this module's contribution to `lib/export/manifest.ts`). */
export interface ExportManifest {
  caseId: string;
  caseName: string;
  generatedAt: string; // ISO 8601
  exportVersion: string;
  sourceFiles: string[];
  eventCount: number;
  iocCount: number;
  mitreTechniqueCount: number;
  bookmarkCount: number;
  noteCount: number;
  threatScore: number;
  threatLevel: RiskLevel;
}

/** "12. Export History" — lightweight metadata only, never the exported
 * file itself. */
export interface ExportHistoryEntry {
  id: string;
  filename: string;
  format: ExportFormat;
  timestamp: string; // ISO 8601
  status: "success" | "failed";
}
