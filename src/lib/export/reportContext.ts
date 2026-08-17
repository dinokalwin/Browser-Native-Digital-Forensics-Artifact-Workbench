/**
 * Export Center — Investigation Report data assembly (Phase 5.11).
 *
 * Builds the same `ReportData`/`ReportPdfExtras` pair
 * `components/report/GenerateReportButton.tsx` (Sprint 5.1 through 5.9.4,
 * untouched by this phase) already assembles for the Dashboard's own
 * "Generate Report" button — reusing every underlying pure function
 * exactly as that button does (`buildReportData`, `calculateStatistics`,
 * `computePerFileStatistics`, `computeCoverageStats`,
 * `computeAdvancedMitreStats`, `buildCoverageMatrix`, `getTopRiskTactics`).
 *
 * This is new, additive code in the export layer, not a modification to
 * `GenerateReportButton.tsx` itself: this phase's "Do NOT rewrite working
 * export functionality" instruction means that component's own logic
 * stays exactly as Sprint 5.9.4 left it, at the cost of one block of
 * structural duplication between the two call sites (the Dashboard's
 * single-report button and this Center's Report/Bundle cards) — a
 * deliberate, documented tradeoff rather than an oversight.
 */
import type { EvtxEvent, InvestigationSummary, SuspiciousFinding, UploadedFileMeta } from "@/types/evidence";
import type { CaseNote, EventNoteMap } from "@/lib/notes";
import type { BookmarkMap } from "@/lib/bookmarks";
import type { MitreAggregation } from "@/lib/mitre/types";
import { buildReportData, type ReportData } from "@/lib/report";
import { calculateStatistics, formatDate } from "@/lib/statistics";
import { computePerFileStatistics } from "@/lib/multiFile";
import { formatFileSize } from "@/lib/utils";
import {
  buildCoverageMatrix,
  computeAdvancedMitreStats,
  computeCoverageStats,
  getTopRiskTactics,
} from "@/lib/mitre/statistics";
import type { ReportPdfExtras } from "@/services/report/pdfSections";

export interface BuildReportContextInput {
  uploadedFile: UploadedFileMeta;
  uploadedFiles: UploadedFileMeta[];
  events: EvtxEvent[];
  investigationSummary: InvestigationSummary | null;
  suspiciousFindings: SuspiciousFinding[];
  caseNote: CaseNote | null;
  eventNotes: EventNoteMap;
  bookmarks: BookmarkMap;
  mitreAggregation: MitreAggregation;
}

export interface ReportContext {
  reportData: ReportData;
  reportExtras: ReportPdfExtras;
}

export function buildReportContext(input: BuildReportContextInput): ReportContext {
  const {
    uploadedFile,
    uploadedFiles,
    events,
    investigationSummary,
    suspiciousFindings,
    caseNote,
    eventNotes,
    bookmarks,
    mitreAggregation,
  } = input;

  const reportData = buildReportData({
    uploadedFile,
    events,
    investigationSummary,
    suspiciousFindings,
    caseNote,
    eventNotes,
    bookmarks,
  });

  const stats = calculateStatistics(events);
  const durationMs =
    stats.earliestTimestamp && stats.latestTimestamp
      ? stats.latestTimestamp.getTime() - stats.earliestTimestamp.getTime()
      : null;

  const evidenceSources = computePerFileStatistics(events, uploadedFiles).map((file) => ({
    fileName: file.fileName,
    sizeLabel: formatFileSize(file.sizeBytes),
    eventCount: file.eventCount,
    earliestEvent: formatDate(file.earliestTimestamp),
    latestEvent: formatDate(file.latestTimestamp),
  }));

  const mitreCoverageStats = computeCoverageStats(mitreAggregation);
  const mitreAdvancedStats = computeAdvancedMitreStats(mitreAggregation);
  const mitreCoverageMatrix = buildCoverageMatrix(mitreAggregation);

  const topTactics = getTopRiskTactics(mitreAggregation, 3).map((tactic) => ({
    tactic,
    findingCount: mitreAggregation.tacticGroups.find((g) => g.tactic === tactic)?.findingCount ?? 0,
  }));

  const topRecommendations = Array.from(
    new Set(
      mitreAggregation.techniques
        .map((t) => t.recommendation.trim())
        .filter((recommendation) => recommendation.length > 0),
    ),
  ).slice(0, 5);

  const reportExtras: ReportPdfExtras = {
    affectedHosts: investigationSummary?.affectedHosts ?? [],
    durationMs,
    evidenceSources,
    mitreAttack: {
      coveragePercent: mitreCoverageStats.coveragePercent,
      observedTechniqueCount: mitreCoverageStats.totalTechniquesObserved,
      totalTechniqueCount: mitreCoverageStats.totalTechniquesKnown,
      observedTacticCount: mitreCoverageStats.uniqueTacticsObserved,
      topTactics,
      highestRiskTechnique: mitreAdvancedStats.highestRiskTechnique
        ? {
            id: mitreAdvancedStats.highestRiskTechnique.id,
            name: mitreAdvancedStats.highestRiskTechnique.name,
            tactic: mitreAdvancedStats.highestRiskTechnique.tactic,
            severity: mitreAdvancedStats.highestRiskTechnique.highestSeverity,
          }
        : null,
      matrixSummary: mitreCoverageMatrix.map((column) => ({
        tactic: column.tactic,
        observedCount: column.cells.filter((cell) => cell.observed).length,
        totalCount: column.cells.length,
        findingCount: column.findingCount,
        highestSeverity: column.highestSeverity,
      })),
      topRecommendations,
    },
  };

  return { reportData, reportExtras };
}
