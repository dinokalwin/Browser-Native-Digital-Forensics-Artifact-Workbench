/**
 * Investigation Report — per-section renderers (Sprint 5.2).
 *
 * Each `renderX` function draws exactly one report section using the
 * primitives in `pdfPrimitives.ts` and the palette in `pdfTheme.ts`. None of
 * these functions call `doc.addPage()` themselves except via
 * `guardPageBreak` (freeform-text overflow) or jspdf-autotable's own
 * built-in pagination — page sequencing (`addPage` between *sections*, page
 * numbering, table of contents, headers/footers) all live in
 * `pdfGenerator.ts`, the only place that owns page flow.
 */
import { jsPDF } from "jspdf";
import type { CellHookData } from "jspdf-autotable";

import type { ReportData } from "@/lib/report";
import type { EventLevel } from "@/types/evidence";

import {
  APP_BRAND,
  LEVEL_COLOR,
  REPORT_TITLE,
  RISK_COLOR,
  RISK_LABEL,
  SEVERITY_COLOR,
  THEME,
} from "./pdfTheme";
import {
  MARGIN,
  computeEventRates,
  dataTable,
  blankCellText,
  drawBadgeChip,
  drawBulletList,
  drawCellBadge,
  drawEmptyState,
  drawMeta,
  drawParagraph,
  drawSectionHeading,
  drawSubheading,
  fill,
  getFinalY,
  guardPageBreak,
  ink,
  keyValueTable,
  pageSize,
  resetTextStyle,
  stroke,
} from "./pdfPrimitives";

/**
 * Extra, presentation-only data `lib/report.ts`'s protected `ReportData`
 * shape deliberately doesn't carry. `GenerateReportButton.tsx` assembles
 * this from data it already has in scope (the store's `investigationSummary`,
 * and a second call to the same `calculateStatistics` utility `report.ts`
 * already uses internally) — nothing here is computed by re-deriving new
 * investigative logic, and `lib/report.ts` itself is never modified.
 */
/**
 * One row of the Evidence Sources table (Phase 5.7 — Multi-EVTX
 * Investigation) — a per-file breakdown of the merged case. Defined here
 * rather than in `lib/report.ts` (protected: this phase's ticket lists
 * "Report generator architecture" as off-limits, and per-file statistics
 * are exactly the kind of presentation-only addition the existing `extras`
 * pattern already exists for — see `affectedHosts`/`durationMs` below,
 * which established this same "extend via extras, never touch
 * `ReportData`" approach in Sprint 5.2).
 */
export interface ReportEvidenceSource {
  fileName: string;
  sizeLabel: string;
  eventCount: number;
  earliestEvent: string;
  latestEvent: string;
}

/**
 * Sprint 5.9.4 — one row of the "ATT&CK Matrix Summary" table, one per
 * MITRE tactic that has at least one *known* technique (i.e. every tactic
 * this app's reference table covers, matching the Coverage Matrix's own
 * "show every known column, mark which are observed" behavior — see
 * `lib/mitre/statistics.ts#buildCoverageMatrix`).
 */
export interface ReportMitreMatrixRow {
  tactic: string;
  observedCount: number;
  totalCount: number;
  findingCount: number;
  highestSeverity: string | null;
}

/** A single "Top Tactics" entry — tactic name plus the finding volume that
 * ranked it, so the PDF list reads the same as the bullet's own text
 * ("Credential Access (4 findings)") rather than a bare name. */
export interface ReportMitreTopTactic {
  tactic: string;
  findingCount: number;
}

/**
 * Sprint 5.9.4, Step 6 — "PDF Report: add a complete MITRE ATT&CK
 * section." Assembled by `GenerateReportButton.tsx` from the same
 * `lib/mitre` aggregation/statistics functions the MITRE ATT&CK page and
 * Dashboard already call (`aggregateMitreFindings`, `computeCoverageStats`,
 * `computeAdvancedMitreStats`, `buildCoverageMatrix`, `getTopRiskTactics`)
 * — no new MITRE logic lives in the report layer, matching this sprint's
 * "Reuse existing aggregation" requirement and this file's own established
 * "extend via extras, never touch `ReportData`" pattern.
 */
export interface ReportMitreAttack {
  coveragePercent: number;
  observedTechniqueCount: number;
  totalTechniqueCount: number;
  observedTacticCount: number;
  topTactics: ReportMitreTopTactic[];
  highestRiskTechnique: { id: string; name: string; tactic: string; severity: string | null } | null;
  matrixSummary: ReportMitreMatrixRow[];
  topRecommendations: string[];
}

export interface ReportPdfExtras {
  /** `InvestigationSummary.affectedHosts` — not present on
   * `ReportExecutiveSummary`. Empty array renders as a graceful "none
   * identified" empty state, same as every other empty-data case. */
  affectedHosts: string[];
  /** Earliest→latest span in milliseconds, used only to derive Events/day
   * and Events/hour in the Timeline Summary. Null when unavailable (e.g.
   * no events with a parseable timestamp). */
  durationMs: number | null;
  /** Phase 5.7 — one row per uploaded file, assembled by
   * `GenerateReportButton.tsx` from `lib/multiFile.ts#computePerFileStatistics`.
   * The "Evidence Sources" section (see `buildSectionList` below) only
   * appears in the report when this has more than one entry — a
   * single-file case's Case Information section already fully identifies
   * its one source, so a one-row Evidence Sources table would be pure
   * redundancy there. */
  evidenceSources: ReportEvidenceSource[];
  /** Sprint 5.9.4 — see `ReportMitreAttack` above. */
  mitreAttack: ReportMitreAttack;
}

const EMPTY_MITRE_ATTACK: ReportMitreAttack = {
  coveragePercent: 0,
  observedTechniqueCount: 0,
  totalTechniqueCount: 0,
  observedTacticCount: 0,
  topTactics: [],
  highestRiskTechnique: null,
  matrixSummary: [],
  topRecommendations: [],
};

export const EMPTY_EXTRAS: ReportPdfExtras = {
  affectedHosts: [],
  durationMs: null,
  evidenceSources: [],
  mitreAttack: EMPTY_MITRE_ATTACK,
};

/** Ordered list of every report section after the cover + table of
 * contents — the single source of truth `pdfGenerator.ts` walks to both
 * render pages and populate the table of contents, so the two can never
 * drift out of sync. */
export function buildSectionList(
  data: ReportData,
  extras: ReportPdfExtras,
): Array<{ title: string; render: (doc: jsPDF) => void }> {
  return [
    { title: "Case Information", render: (doc) => renderCaseInformation(doc, data.caseInfo) },
    // Phase 5.7 — only included once there's more than one evidence file;
    // see ReportPdfExtras.evidenceSources' doc comment above.
    ...(extras.evidenceSources.length > 1
      ? [
          {
            title: "Evidence Sources",
            render: (doc: jsPDF) => renderEvidenceSources(doc, extras.evidenceSources),
          },
        ]
      : []),
    {
      title: "Executive Summary",
      render: (doc) => renderExecutiveSummary(doc, data.executiveSummary, extras.affectedHosts),
    },
    { title: "Investigation Statistics", render: (doc) => renderStatistics(doc, data.statistics) },
    {
      title: "Timeline Summary",
      render: (doc) =>
        renderTimelineSummary(doc, data.timelineSummary, data.caseInfo.totalEvents, extras.durationMs),
    },
    { title: "Bookmarked Events", render: (doc) => renderBookmarkedEvents(doc, data.bookmarkedEvents) },
    { title: "Investigator Notes", render: (doc) => renderNotes(doc, data.notes) },
    { title: "Suspicious Events", render: (doc) => renderSuspiciousEvents(doc, data.suspiciousFindings) },
    // Sprint 5.9.4 — placed after Suspicious Events (the finding-level
    // detail this section summarizes at the technique/tactic level) and
    // before the Conclusion, so the report reads finding detail -> ATT&CK
    // rollup -> overall conclusion.
    { title: "MITRE ATT&CK", render: (doc) => renderMitreAttack(doc, extras.mitreAttack) },
    { title: "Investigation Conclusion", render: (doc) => renderConclusion(doc, data.conclusion) },
  ];
}

// ---------------------------------------------------------------------------
// Cover page
// ---------------------------------------------------------------------------

export function renderCoverPage(doc: jsPDF, data: ReportData): void {
  const { width, height } = pageSize(doc);
  const bannerHeight = 200;

  fill(doc, THEME.primary);
  doc.rect(0, 0, width, bannerHeight, "F");
  stroke(doc, THEME.primaryDark);
  doc.setLineWidth(3);
  doc.line(0, bannerHeight, width, bannerHeight);

  ink(doc, THEME.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(APP_BRAND, width / 2, bannerHeight / 2 - 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(REPORT_TITLE, width / 2, bannerHeight / 2 + 20, { align: "center" });
  resetTextStyle(doc);

  const riskScore = data.executiveSummary.riskScore;
  const rows: Array<{ label: string; value: string; badge?: { text: string; color: [number, number, number] } }> = [
    { label: "Case Filename", value: data.cover.caseFilename },
    { label: "Generated", value: data.cover.generatedAt.toLocaleString() },
    { label: "Application Version", value: `v${data.cover.appVersion}` },
    { label: "Total Events", value: data.caseInfo.totalEvents.toLocaleString() },
    riskScore
      ? {
          label: "Risk Score",
          value: `${riskScore.score}/100`,
          badge: { text: RISK_LABEL[riskScore.level], color: RISK_COLOR[riskScore.level] },
        }
      : { label: "Risk Score", value: "N/A" },
    { label: "Investigation Duration", value: data.caseInfo.investigationDuration },
  ];

  const rowHeight = 56;
  const blockHeight = rows.length * rowHeight;
  const availableTop = bannerHeight + 20;
  const availableBottom = height - 80;
  let y = availableTop + Math.max(0, (availableBottom - availableTop - blockHeight) / 2);

  for (const row of rows) {
    ink(doc, THEME.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(row.label.toUpperCase(), width / 2, y, { align: "center" });

    ink(doc, THEME.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(row.value, width / 2, y + 20, { align: "center" });

    if (row.badge) {
      drawBadgeChip(doc, row.badge.text, width / 2, y + 29, row.badge.color, "center");
    }

    y += rowHeight;
  }

  resetTextStyle(doc);
  ink(doc, THEME.muted);
  doc.setFontSize(9);
  doc.text(
    "Generated entirely in-browser from parsed EVTX evidence. No data leaves this device.",
    width / 2,
    height - 90,
    { align: "center" },
  );
  resetTextStyle(doc);
}

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

export function renderTableOfContents(doc: jsPDF, entries: Array<{ title: string; page: number }>): void {
  let y = drawSectionHeading(doc, "Table of Contents");
  const { width } = pageSize(doc);
  const rightX = width - MARGIN;

  entries.forEach((entry, index) => {
    const pageLabel = String(entry.page);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    ink(doc, THEME.text);
    doc.text(`${index + 1}`, MARGIN, y);

    doc.setFont("helvetica", "normal");
    doc.text(entry.title, MARGIN + 22, y);
    const titleWidth = doc.getTextWidth(entry.title);

    ink(doc, THEME.muted);
    doc.text(pageLabel, rightX, y, { align: "right" });
    const pageLabelWidth = doc.getTextWidth(pageLabel);

    const dotsStart = MARGIN + 22 + titleWidth + 6;
    const dotsEnd = rightX - pageLabelWidth - 6;
    if (dotsEnd > dotsStart) {
      stroke(doc, THEME.border);
      doc.setLineDashPattern([1, 2], 0);
      doc.setLineWidth(0.75);
      doc.line(dotsStart, y - 3, dotsEnd, y - 3);
      doc.setLineDashPattern([], 0);
    }

    resetTextStyle(doc);
    y += 26;
  });
}

// ---------------------------------------------------------------------------
// Case information
// ---------------------------------------------------------------------------

export function renderCaseInformation(doc: jsPDF, caseInfo: ReportData["caseInfo"]): void {
  const y = drawSectionHeading(doc, "Case Information");
  keyValueTable(doc, y, [
    ["Filename", caseInfo.filename],
    ["File Size", caseInfo.fileSizeLabel],
    ["Total Events", caseInfo.totalEvents.toLocaleString()],
    ["Unique Providers", caseInfo.uniqueProviders.toLocaleString()],
    ["Unique Computers", caseInfo.uniqueComputers.toLocaleString()],
    ["Unique Event IDs", caseInfo.uniqueEventIds.toLocaleString()],
    ["Investigation Duration", caseInfo.investigationDuration],
  ]);
}

// ---------------------------------------------------------------------------
// Evidence sources (Phase 5.7 — Multi-EVTX Investigation)
// ---------------------------------------------------------------------------

/**
 * Per-file breakdown for a multi-file investigation — filename, size, event
 * count, and that file's own earliest/latest event, one row per uploaded
 * EVTX file. Only reached via `buildSectionList` when there are 2+ sources
 * (see that gate above); the `sources.length === 0` branch below is a
 * defensive fallback only, matching this report's "never throw on missing
 * data" convention rather than assuming that gate can never change.
 */
export function renderEvidenceSources(doc: jsPDF, sources: ReportPdfExtras["evidenceSources"]): void {
  const y = drawSectionHeading(doc, "Evidence Sources");
  if (sources.length === 0) {
    drawEmptyState(doc, y, "This investigation was generated from a single evidence file.");
    return;
  }

  dataTable(doc, {
    startY: y,
    head: [["Filename", "Size", "Events", "Earliest Event", "Latest Event"]],
    body: sources.map((source) => [
      source.fileName,
      source.sizeLabel,
      source.eventCount.toLocaleString(),
      source.earliestEvent,
      source.latestEvent,
    ]),
    columnStyles: {
      1: { halign: "center", cellWidth: 60 },
      2: { halign: "center", cellWidth: 60 },
      3: { cellWidth: 115 },
      4: { cellWidth: 115 },
    },
  });
}

// ---------------------------------------------------------------------------
// Executive summary
// ---------------------------------------------------------------------------

export function renderExecutiveSummary(
  doc: jsPDF,
  summary: ReportData["executiveSummary"],
  affectedHosts: string[],
): void {
  let y = drawSectionHeading(doc, "Executive Summary");
  const textWidth = pageSize(doc).width - MARGIN * 2;
  const hasAnyContent = Boolean(summary.headline) || Boolean(summary.narrative) || summary.keyFindings.length > 0
    || Boolean(summary.riskScore) || affectedHosts.length > 0;

  if (!hasAnyContent) {
    drawEmptyState(doc, y, "No investigation summary is available for this case.");
    return;
  }

  // Overview
  y = drawSubheading(doc, "Overview", y);
  y = summary.headline
    ? drawParagraph(doc, summary.headline, MARGIN, y, textWidth) + 16
    : drawEmptyState(doc, y, "No overview headline was generated for this case.") + 8;

  y = guardPageBreak(doc, y, 90);

  // Key Findings
  y = drawSubheading(doc, "Key Findings", y);
  y = summary.keyFindings.length > 0
    ? drawBulletList(doc, summary.keyFindings, MARGIN, y, textWidth) + 12
    : drawEmptyState(doc, y, "No key findings were flagged for this case.") + 8;

  y = guardPageBreak(doc, y, 90);

  // Affected Hosts
  y = drawSubheading(doc, "Affected Hosts", y);
  y = affectedHosts.length > 0
    ? drawBulletList(doc, affectedHosts, MARGIN, y, textWidth) + 12
    : drawEmptyState(doc, y, "No affected hosts were identified for this case.") + 8;

  y = guardPageBreak(doc, y, 100);

  // Risk Assessment
  y = drawSubheading(doc, "Risk Assessment", y);
  if (summary.riskScore) {
    const badgeWidth = drawBadgeChip(
      doc,
      RISK_LABEL[summary.riskScore.level],
      MARGIN,
      y - 11,
      RISK_COLOR[summary.riskScore.level],
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    ink(doc, THEME.text);
    doc.text(`${summary.riskScore.score}/100`, MARGIN + badgeWidth + 10, y);
    resetTextStyle(doc);
    y += 20;
  } else {
    y = drawEmptyState(doc, y, "No risk score is available for this case.") + 8;
  }
  doc.text(`Suspicious Findings: ${summary.suspiciousFindingsCount.toLocaleString()}`, MARGIN, y);
  y += 24;

  y = guardPageBreak(doc, y, 70);

  // Summary
  y = drawSubheading(doc, "Summary", y);
  if (summary.narrative) {
    drawParagraph(doc, summary.narrative, MARGIN, y, textWidth);
  } else {
    drawEmptyState(doc, y, "No narrative summary was generated for this case.");
  }
}

// ---------------------------------------------------------------------------
// Investigation statistics
// ---------------------------------------------------------------------------

export function renderStatistics(doc: jsPDF, stats: ReportData["statistics"]): void {
  const y = drawSectionHeading(doc, "Investigation Statistics");
  keyValueTable(doc, y, [
    ["Total Events", stats.totalEvents.toLocaleString()],
    ["Unique Providers", stats.uniqueProviders.toLocaleString()],
    ["Unique Computers", stats.uniqueComputers.toLocaleString()],
    ["Unique Event IDs", stats.uniqueEventIds.toLocaleString()],
    ["Date Range", stats.dateRange],
    ["Log Duration", stats.logDuration],
  ]);
}

// ---------------------------------------------------------------------------
// Timeline summary
// ---------------------------------------------------------------------------

export function renderTimelineSummary(
  doc: jsPDF,
  summary: ReportData["timelineSummary"],
  totalEvents: number,
  durationMs: number | null,
): void {
  const y = drawSectionHeading(doc, "Timeline Summary");
  const rates = computeEventRates(totalEvents, durationMs);
  keyValueTable(doc, y, [
    ["Earliest Event", summary.earliestEvent],
    ["Latest Event", summary.latestEvent],
    ["Duration", summary.span],
    ["Events / Day", rates.perDay],
    ["Events / Hour", rates.perHour],
  ]);
}

// ---------------------------------------------------------------------------
// Bookmarked events
// ---------------------------------------------------------------------------

export function renderBookmarkedEvents(doc: jsPDF, events: ReportData["bookmarkedEvents"]): void {
  const y = drawSectionHeading(doc, "Bookmarked Events");
  if (events.length === 0) {
    drawEmptyState(doc, y, "No events were bookmarked in this investigation.");
    return;
  }

  const levelColorFor = (raw: string): [number, number, number] | undefined => LEVEL_COLOR[raw as EventLevel];

  dataTable(doc, {
    startY: y,
    head: [["Timestamp", "Event ID", "Provider", "Level", "Computer", "Message"]],
    body: events.map((event) => [
      event.timestamp,
      String(event.eventId),
      event.provider,
      event.level,
      event.computer,
      event.message,
    ]),
    columnStyles: {
      1: { halign: "center", cellWidth: 52 },
      3: { halign: "center", cellWidth: 70 },
      5: { cellWidth: 155 },
    },
    didParseCell: (data: CellHookData) => blankCellText(data, 3),
    didDrawCell: (data: CellHookData) => drawCellBadge(doc, data, 3, levelColorFor),
  });
}

// ---------------------------------------------------------------------------
// Investigator notes
// ---------------------------------------------------------------------------

export function renderNotes(doc: jsPDF, notes: ReportData["notes"]): void {
  let y = drawSectionHeading(doc, "Investigator Notes");
  const textWidth = pageSize(doc).width - MARGIN * 2;

  y = drawSubheading(doc, "Case Notes", y);
  if (notes.caseNote) {
    y = drawParagraph(doc, notes.caseNote.text, MARGIN, y, textWidth) + 6;
    drawMeta(doc, `Last edited ${notes.caseNote.updatedAt}`, MARGIN, y);
    y += 26;
  } else {
    y = drawEmptyState(doc, y, "No case notes recorded.") + 20;
  }

  y = guardPageBreak(doc, y, 60);

  y = drawSubheading(doc, "Event Notes", y);
  if (notes.eventNotes.length === 0) {
    drawEmptyState(doc, y, "No event-level notes recorded.");
    return;
  }

  dataTable(doc, {
    startY: y + 6,
    head: [["Event", "Note", "Last Edited"]],
    body: notes.eventNotes.map((note) => [note.eventSummary, note.text, note.updatedAt]),
    columnStyles: { 0: { cellWidth: 150 }, 2: { halign: "center", cellWidth: 85 } },
  });
}

// ---------------------------------------------------------------------------
// Suspicious events
// ---------------------------------------------------------------------------

export function renderSuspiciousEvents(doc: jsPDF, findings: ReportData["suspiciousFindings"]): void {
  const y = drawSectionHeading(doc, "Suspicious Events");
  if (findings.length === 0) {
    drawEmptyState(doc, y, "No suspicious findings were detected in this investigation.");
    return;
  }

  const severityColorFor = (raw: string): [number, number, number] | undefined =>
    SEVERITY_COLOR[raw as keyof typeof SEVERITY_COLOR];

  dataTable(doc, {
    startY: y,
    head: [["Finding", "Severity", "MITRE", "Related Event", "Description"]],
    body: findings.map((finding) => [
      finding.title,
      finding.severity,
      finding.mitreTechnique ?? "—",
      finding.eventSummary,
      finding.description,
    ]),
    columnStyles: {
      1: { halign: "center", cellWidth: 80 },
      2: { halign: "center", cellWidth: 55 },
      3: { cellWidth: 110 },
      4: { cellWidth: 140 },
    },
    didParseCell: (data: CellHookData) => blankCellText(data, 1),
    didDrawCell: (data: CellHookData) => drawCellBadge(doc, data, 1, severityColorFor),
  });
}

// ---------------------------------------------------------------------------
// MITRE ATT&CK (Sprint 5.9.4)
// ---------------------------------------------------------------------------

/**
 * Full MITRE ATT&CK section (Sprint 5.9.4, Step 6): a Coverage summary
 * (Coverage %, Observed Techniques/Tactics, Highest Risk Technique), a Top
 * Tactics bullet list, an ATT&CK Matrix Summary table (one row per known
 * tactic — observed/total technique counts, finding volume, highest
 * severity), and a Top Recommendations bullet list. Every value comes
 * pre-computed through `extras.mitreAttack` (see that interface's doc
 * comment) — this function only draws, matching every other section in
 * this file.
 */
export function renderMitreAttack(doc: jsPDF, mitre: ReportPdfExtras["mitreAttack"]): void {
  let y = drawSectionHeading(doc, "MITRE ATT&CK");
  const textWidth = pageSize(doc).width - MARGIN * 2;

  if (mitre.observedTechniqueCount === 0) {
    drawEmptyState(doc, y, "No ATT&CK techniques were observed in this case.");
    return;
  }

  y = drawSubheading(doc, "Coverage", y);
  keyValueTable(doc, y, [
    ["Coverage %", `${mitre.coveragePercent}%`],
    ["Observed Techniques", `${mitre.observedTechniqueCount} of ${mitre.totalTechniqueCount}`],
    ["Observed Tactics", mitre.observedTacticCount.toLocaleString()],
    [
      "Highest Risk Technique",
      mitre.highestRiskTechnique
        ? `${mitre.highestRiskTechnique.id} — ${mitre.highestRiskTechnique.name} (${mitre.highestRiskTechnique.tactic})`
        : "None observed",
    ],
  ]);
  y = getFinalY(doc, y) + 28;

  y = guardPageBreak(doc, y, 90);
  y = drawSubheading(doc, "Top Tactics", y);
  y =
    mitre.topTactics.length > 0
      ? drawBulletList(
          doc,
          mitre.topTactics.map((t) => `${t.tactic} (${t.findingCount.toLocaleString()} finding${t.findingCount === 1 ? "" : "s"})`),
          MARGIN,
          y,
          textWidth,
        ) + 12
      : drawEmptyState(doc, y, "No tactics were observed for this case.") + 8;

  y = guardPageBreak(doc, y, 140);
  y = drawSubheading(doc, "ATT&CK Matrix Summary", y);

  const severityColorFor = (raw: string): [number, number, number] | undefined =>
    SEVERITY_COLOR[raw as keyof typeof SEVERITY_COLOR];

  dataTable(doc, {
    startY: y,
    head: [["Tactic", "Techniques Observed", "Findings", "Highest Severity"]],
    body: mitre.matrixSummary.map((row) => [
      row.tactic,
      `${row.observedCount}/${row.totalCount}`,
      row.findingCount.toLocaleString(),
      row.highestSeverity ?? "—",
    ]),
    columnStyles: {
      1: { halign: "center", cellWidth: 110 },
      2: { halign: "center", cellWidth: 70 },
      3: { halign: "center", cellWidth: 90 },
    },
    didParseCell: (data: CellHookData) => blankCellText(data, 3),
    didDrawCell: (data: CellHookData) => drawCellBadge(doc, data, 3, severityColorFor),
  });
  y = getFinalY(doc, y) + 24;

  y = guardPageBreak(doc, y, 90);
  y = drawSubheading(doc, "Top Recommendations", y);
  y =
    mitre.topRecommendations.length > 0
      ? drawBulletList(doc, mitre.topRecommendations, MARGIN, y, textWidth)
      : drawEmptyState(doc, y, "No recommendations were generated for this case.");
}

// ---------------------------------------------------------------------------
// Investigation conclusion
// ---------------------------------------------------------------------------

export function renderConclusion(doc: jsPDF, conclusion: ReportData["conclusion"]): void {
  let y = drawSectionHeading(doc, "Investigation Conclusion");
  const textWidth = pageSize(doc).width - MARGIN * 2;

  y = drawSubheading(doc, "Overall Summary", y);
  y = drawParagraph(doc, buildConclusionSummary(conclusion), MARGIN, y, textWidth) + 18;

  y = guardPageBreak(doc, y, 150);

  y = drawSubheading(doc, "Findings", y);
  keyValueTable(doc, y, [
    ["Risk Score", conclusion.riskScoreLabel],
    ["Suspicious Event Count", conclusion.suspiciousEventCount.toLocaleString()],
    ["Bookmark Count", conclusion.bookmarkCount.toLocaleString()],
    ["Notes Count", conclusion.notesCount.toLocaleString()],
    ["Timeline Span", conclusion.timelineSpan],
  ]);
  y = getFinalY(doc, y) + 28;

  y = guardPageBreak(doc, y, 120);

  y = drawSubheading(doc, "Recommendations", y);
  y = drawBulletList(doc, buildRecommendations(conclusion), MARGIN, y, textWidth) + 16;

  y = guardPageBreak(doc, y, 210);

  y = drawSubheading(doc, "Analyst Notes", y);
  const boxTop = y + 4;
  const boxHeight = 130;
  stroke(doc, THEME.border);
  doc.setLineWidth(0.75);
  doc.rect(MARGIN, boxTop, textWidth, boxHeight);
  for (let lineY = boxTop + 26; lineY < boxTop + boxHeight; lineY += 26) {
    doc.line(MARGIN + 10, lineY, MARGIN + textWidth - 10, lineY);
  }
  y = boxTop + boxHeight + 44;

  y = guardPageBreak(doc, y, 60);

  const halfWidth = (textWidth - 30) / 2;
  stroke(doc, THEME.border);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, MARGIN + halfWidth, y);
  doc.line(MARGIN + halfWidth + 30, y, MARGIN + textWidth, y);
  drawMeta(doc, "Investigator Signature", MARGIN, y + 14);
  drawMeta(doc, "Date", MARGIN + halfWidth + 30, y + 14);
}

function buildConclusionSummary(conclusion: ReportData["conclusion"]): string {
  const parts = [
    `This investigation reviewed the available event log data with an overall risk assessment of ${conclusion.riskScoreLabel}.`,
    conclusion.suspiciousEventCount > 0
      ? `${conclusion.suspiciousEventCount.toLocaleString()} suspicious finding${conclusion.suspiciousEventCount === 1 ? "" : "s"} were identified and are detailed in the Suspicious Events section.`
      : "No suspicious findings were identified by the automated detection rules.",
    conclusion.bookmarkCount > 0
      ? `The investigator bookmarked ${conclusion.bookmarkCount.toLocaleString()} event${conclusion.bookmarkCount === 1 ? "" : "s"} of particular interest.`
      : "No events were bookmarked during this investigation.",
    conclusion.notesCount > 0
      ? `${conclusion.notesCount.toLocaleString()} investigator note${conclusion.notesCount === 1 ? "" : "s"} were recorded.`
      : "No investigator notes were recorded.",
    `The reviewed activity spans ${conclusion.timelineSpan === "N/A" ? "an indeterminate timeframe" : conclusion.timelineSpan}.`,
  ];
  return parts.join(" ");
}

function buildRecommendations(conclusion: ReportData["conclusion"]): string[] {
  const label = conclusion.riskScoreLabel.toLowerCase();
  const items: string[] = [];

  if (label.includes("critical")) {
    items.push("Escalate this case to incident response given the critical risk assessment.");
  } else if (label.includes("high")) {
    items.push("Prioritize further review given the high risk assessment.");
  }
  if (conclusion.suspiciousEventCount > 0) {
    items.push("Review each flagged suspicious event and corroborate against other available evidence sources.");
  }
  if (conclusion.bookmarkCount > 0) {
    items.push("Review bookmarked events for evidentiary value and chain-of-custody documentation.");
  }
  if (items.length === 0) {
    items.push("No immediate action items were identified by the automated analysis. Continue standard review procedures.");
  }
  items.push("Validate findings against additional log sources where available before drawing final conclusions.");
  return items;
}
