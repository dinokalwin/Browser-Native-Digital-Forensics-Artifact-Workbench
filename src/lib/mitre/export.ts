/**
 * MITRE ATT&CK Heatmap — CSV export (Sprint 5.9.3, Step 9).
 *
 * Pure, framework-free: no React, no DOM APIs beyond the `Blob` constructor
 * (available in both the browser and this project's Node-based verification
 * harness, unlike `document`/`canvas` — see `services/mitre/matrixPng.ts`
 * for the PNG side of this same export feature, which does need the DOM
 * and so lives in `services/`, not here, mirroring
 * `services/report/pdfGenerator.ts`'s existing "DOM/library-touching export
 * code lives in services/, pure data prep lives in lib/" split).
 *
 * The CSV escaping here is a small, deliberate duplicate of
 * `backend/csv-export.ts`'s `escapeCsvField`/`neutralizeFormulaInjection` —
 * not an import, since that module is scoped to `EvtxEvent` rows and
 * reaching into `backend/` from `lib/mitre/` would be an odd, one-off
 * dependency for two small helper functions. Same CWE-1236 formula-
 * injection defense either way: this matrix's cell data ultimately
 * originates from the same attacker-influenced event log content
 * (`DetectionFinding.title`/`recommendation`, sourced from EVTX field
 * values), so it deserves the identical protection when opened in a
 * spreadsheet application.
 */
import type { CoverageMatrixColumn } from "./statistics";

function neutralizeFormulaInjection(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : neutralizeFormulaInjection(String(value));
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADER = [
  "Tactic",
  "Technique ID",
  "Technique Name",
  "Observed",
  "Finding Count",
  "Highest Severity",
  "Tactic Risk Score",
  "Recommendation",
];

/**
 * One row per *known* technique cell (observed or not), across every
 * tactic column — the full matrix, not just what's currently visible under
 * the Heatmap Filters toggles (an analyst exporting "the matrix" expects
 * the complete picture; the on-screen heatmap's own declutter toggles are
 * a display convenience, not a data reduction). Bounded by the known
 * technique count (currently 13), same size class as everything else this
 * module touches — not a re-scan of `iocFindings`.
 */
export function buildHeatmapCsvText(columns: readonly CoverageMatrixColumn[]): string {
  const rows = columns.flatMap((column) =>
    column.cells.map((cell) =>
      [
        column.tactic,
        cell.id,
        cell.name,
        cell.observed ? "Yes" : "No",
        cell.findingCount,
        cell.highestSeverity ?? "",
        column.riskScore,
        cell.recommendation,
      ]
        .map(escapeCsvField)
        .join(","),
    ),
  );
  return [CSV_HEADER.map(escapeCsvField).join(","), ...rows].join("\r\n");
}

/** Leading BOM so Excel reliably detects UTF-8 instead of guessing wrong —
 * same convention `backend/csv-export.ts#exportEventsAsCSV` uses. */
export function buildHeatmapCsvBlob(columns: readonly CoverageMatrixColumn[]): Blob {
  return new Blob(["﻿" + buildHeatmapCsvText(columns)], { type: "text/csv;charset=utf-8;" });
}
