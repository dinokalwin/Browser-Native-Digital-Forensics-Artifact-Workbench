/**
 * Export Center — CSV builders (Phase 5.11).
 *
 * Pure, framework-free: no React, no DOM beyond the `Blob` constructor
 * (same as `backend/csv-export.ts` / `lib/mitre/export.ts`, both usable in
 * this project's Node-based verification harness). Reuses the existing
 * evidence CSV export (`services/evtxApi.ts#exportCSV`) rather than
 * duplicating it — this module only builds CSV for the shapes that don't
 * already have one: Timeline rows, IOC findings, and MITRE techniques.
 *
 * The escaping/formula-injection guard here is a small, deliberate
 * duplicate of `backend/csv-export.ts#escapeCsvField`/
 * `neutralizeFormulaInjection` — the same precedent `lib/mitre/export.ts`
 * already established (see that file's own doc comment) rather than
 * reaching into `backend/` from `lib/export/` for two small helpers. Same
 * CWE-1236 formula-injection defense either way: every field exported here
 * ultimately originates from attacker-influenced event log content.
 */
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreTechniqueSummary } from "@/lib/mitre/types";

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

function toCsvText(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return lines.join("\r\n");
}

/** Leading BOM so Excel reliably detects UTF-8 instead of guessing wrong —
 * same convention every other CSV export in this app uses. */
function csvBlob(text: string): Blob {
  return new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
}

const TIMELINE_CSV_HEADER = ["Date", "Time", "Event ID", "Level", "Provider", "Computer", "User", "Summary"];

/**
 * One row per event, oldest first — a plain chronological export distinct
 * from the Evidence export's "original field order" (which follows however
 * `mergeAndSortEvents` merged multi-file input), matching how the Timeline
 * page's own concept of "the case in order" is a presentation choice, not
 * the underlying dataset itself. Does not mutate or re-sort `events` in
 * place — builds a new sorted array once, same "no unnecessary copies
 * beyond what sorting requires" contract as `lib/timeline.ts#groupEventsByDay`.
 */
export function buildTimelineCsvText(events: readonly EvtxEvent[]): string {
  const sorted = events.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const rows = sorted.map((event) => {
    const date = new Date(event.timestamp);
    const isValid = !Number.isNaN(date.getTime());
    const iso = isValid ? date.toISOString() : "";
    return [
      isValid ? iso.slice(0, 10) : "Unknown",
      isValid ? iso.slice(11, 19) : "",
      event.eventId,
      event.level,
      event.provider || "Unknown",
      event.computer || "Unknown",
      event.user || "",
      event.message || "",
    ];
  });
  return toCsvText(TIMELINE_CSV_HEADER, rows);
}

export function buildTimelineCsvBlob(events: readonly EvtxEvent[]): Blob {
  return csvBlob(buildTimelineCsvText(events));
}

const IOC_CSV_HEADER = [
  "Rule",
  "Title",
  "Severity",
  "MITRE Technique",
  "Event Timestamp",
  "Windows Event ID",
  "Description",
  "Recommendation",
  // Phase 5.13 — Detection Engine 2.0. Appended, not inserted, so any
  // existing spreadsheet/script built against this header's column
  // positions keeps working; the three new columns are simply blank for
  // any finding that predates the context-aware engine (there shouldn't be
  // any in practice, but `finding.confidence`/etc. are still optional on
  // the type, so this stays defensive rather than assumed).
  "Confidence",
  "Confidence Level",
  "Risk Score",
];

/**
 * One row per IOC finding. `eventById` (built once by the caller — see
 * `ExportCenter.tsx`) resolves each finding's `eventId` FK to its
 * timestamp/Windows event id for a self-contained, spreadsheet-friendly
 * row; a finding whose event isn't resolvable (shouldn't happen in
 * practice, but never assumed) just leaves those two columns blank rather
 * than throwing.
 */
export function buildIocCsvText(
  findings: readonly DetectionFinding[],
  eventById: ReadonlyMap<string, EvtxEvent>,
): string {
  const rows = findings.map((finding) => {
    const event = eventById.get(finding.eventId);
    return [
      finding.ruleName,
      finding.title,
      finding.severity,
      finding.mitreTechnique ?? "",
      event ? event.timestamp : "",
      event ? event.eventId : "",
      finding.description,
      finding.recommendation,
      finding.confidence ?? "",
      finding.confidenceLevel ?? "",
      finding.riskScore ?? "",
    ];
  });
  return toCsvText(IOC_CSV_HEADER, rows);
}

export function buildIocCsvBlob(
  findings: readonly DetectionFinding[],
  eventById: ReadonlyMap<string, EvtxEvent>,
): Blob {
  return csvBlob(buildIocCsvText(findings, eventById));
}

const MITRE_CSV_HEADER = [
  "Tactic",
  "Technique ID",
  "Technique Name",
  "Finding Count",
  "Highest Severity",
  "Critical",
  "Warning",
  "Informational",
  "Recommendation",
];

/** One row per *observed* technique (`MitreAggregation.techniques` — never
 * re-aggregated here, the caller passes the same array every other
 * MITRE-aware page already computed via `aggregateMitreFindings`). */
export function buildMitreCsvText(techniques: readonly MitreTechniqueSummary[]): string {
  const rows = techniques.map((technique) => [
    technique.tactic,
    technique.id,
    technique.name,
    technique.findingCount,
    technique.highestSeverity ?? "",
    technique.severityCounts.critical,
    technique.severityCounts.warning,
    technique.severityCounts.informational,
    technique.recommendation,
  ]);
  return toCsvText(MITRE_CSV_HEADER, rows);
}

export function buildMitreCsvBlob(techniques: readonly MitreTechniqueSummary[]): Blob {
  return csvBlob(buildMitreCsvText(techniques));
}
