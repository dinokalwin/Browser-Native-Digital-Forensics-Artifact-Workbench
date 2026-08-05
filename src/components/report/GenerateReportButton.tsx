import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useEvidenceStore } from "@/store/evidenceStore";
import { useNotesStore } from "@/store/notesStore";
import { useBookmarksStore } from "@/store/bookmarksStore";
import { buildReportData } from "@/lib/report";
import { calculateStatistics, formatDate } from "@/lib/statistics";
import { computePerFileStatistics } from "@/lib/multiFile";
import { formatFileSize } from "@/lib/utils";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import { buildCoverageMatrix, computeAdvancedMitreStats, computeCoverageStats, getTopRiskTactics } from "@/lib/mitre/statistics";
import { Button } from "@/components/ui/button";

/**
 * Dashboard action that assembles a `ReportData` (lib/report.ts) from
 * whatever's currently in `evidenceStore`/`notesStore`/`bookmarksStore`
 * and renders it to a downloadable PDF (services/report/pdfGenerator.ts).
 *
 * Deliberately does *not* subscribe to `notesStore`/`bookmarksStore` via
 * their hooks — this component only needs their CURRENT contents at the
 * moment the investigator clicks "Generate Report", not a live
 * subscription that would re-render this button every time a note or
 * bookmark changes anywhere else on the page. `.getState()` reads the
 * store once, on demand, matching this sprint's "generate on demand, do
 * not precompute" performance requirement.
 */
export function GenerateReportButton() {
  const uploadedFile = useEvidenceStore((s) => s.uploadedFile);
  const events = useEvidenceStore((s) => s.events);
  const suspiciousFindings = useEvidenceStore((s) => s.suspiciousFindings);
  const investigationSummary = useEvidenceStore((s) => s.investigationSummary);
  // Sprint 5.9.4 — IOC Detection Engine findings, read the same way
  // `DashboardPage`/`AnalyticsPanel` already do, purely to feed the new
  // MITRE ATT&CK report section below via the same `lib/mitre` functions
  // those pages call — no new detection or aggregation logic.
  const iocFindings = useEvidenceStore((s) => s.iocFindings);
  // Phase 5.7 — Multi-EVTX Investigation. Read alongside `uploadedFile`
  // rather than replacing it: `uploadedFile` still drives the report's
  // cover/Case Information exactly as before (see lib/report.ts, untouched
  // by this phase), while this new array only feeds the additive Evidence
  // Sources section below.
  const uploadedFiles = useEvidenceStore((s) => s.uploadedFiles);

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");

  const handleGenerate = async () => {
    if (!uploadedFile) return;
    setIsGenerating(true);
    setStatusMessage("Generating investigation report…");

    try {
      // `jspdf`/`jspdf-autotable` (and their own transitive dependencies —
      // together several hundred kB) are only ever needed once an
      // investigator actually asks for a report, so this is a dynamic
      // import rather than a static one at the top of the file: Vite
      // splits pdfGenerator.ts and everything it imports into its own
      // chunk, fetched on demand instead of bloating the Dashboard's
      // initial bundle for every session that never generates a report.
      const [{ downloadReportPdf }] = await Promise.all([
        import("@/services/report/pdfGenerator"),
        // Yield at least one tick so the loading state actually paints
        // before the synchronous PDF-generation work below (non-trivial
        // for a large case's tables) blocks the main thread.
        new Promise((resolve) => setTimeout(resolve, 0)),
      ]);

      const caseId = uploadedFile.name;
      const notesState = useNotesStore.getState();
      const bookmarksState = useBookmarksStore.getState();

      const reportData = buildReportData({
        uploadedFile,
        events,
        investigationSummary,
        suspiciousFindings,
        caseNote: notesState.caseNotes[caseId] ?? null,
        eventNotes: notesState.eventNotes[caseId] ?? {},
        bookmarks: bookmarksState.bookmarks[caseId] ?? {},
      });

      // Sprint 5.2 — `ReportData` (lib/report.ts) deliberately doesn't carry
      // `affectedHosts` or a raw millisecond duration; those two extra,
      // presentation-only values are assembled here instead, from data
      // already in scope, without adding anything to lib/report.ts:
      //  - `affectedHosts` comes straight from `investigationSummary`
      //    (a field it already has, just not one `buildReportData` copies
      //    into `ReportExecutiveSummary`).
      //  - `durationMs` reuses the same `calculateStatistics` utility
      //    `buildReportData` already calls internally, just kept as a raw
      //    Date/number instead of the pre-formatted string `ReportData`
      //    exposes, so the PDF can compute an exact events/day rate.
      const stats = calculateStatistics(events);
      const durationMs =
        stats.earliestTimestamp && stats.latestTimestamp
          ? stats.latestTimestamp.getTime() - stats.earliestTimestamp.getTime()
          : null;

      // Phase 5.7 — per-file breakdown for the Evidence Sources section.
      // `computePerFileStatistics` reuses the same single-pass-then-per-file
      // derivation already used by the Dashboard's own MultiFileSummaryCard;
      // for a single-file case this is a one-row array, and
      // `buildSectionList` (pdfSections.ts) simply omits the section then.
      const evidenceSources = computePerFileStatistics(events, uploadedFiles).map((file) => ({
        fileName: file.fileName,
        sizeLabel: formatFileSize(file.sizeBytes),
        eventCount: file.eventCount,
        earliestEvent: formatDate(file.earliestTimestamp),
        latestEvent: formatDate(file.latestTimestamp),
      }));

      // Sprint 5.9.4 — MITRE ATT&CK report section. Same three `lib/mitre`
      // calls the Dashboard and MITRE ATT&CK page already make from
      // `iocFindings` (`aggregateMitreFindings` -> `computeCoverageStats`/
      // `computeAdvancedMitreStats`/`buildCoverageMatrix`) — this button
      // reuses them a third time rather than re-deriving anything, then
      // reshapes the results into the small, presentation-only
      // `ReportPdfExtras.mitreAttack` shape `pdfSections.ts#renderMitreAttack`
      // expects (mirroring how `evidenceSources` above reshapes
      // `computePerFileStatistics`'s output for its own table).
      const mitreAggregation = aggregateMitreFindings(iocFindings);
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

      downloadReportPdf(reportData, {
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
      });

      setStatusMessage("Investigation report generated.");
      toast.success("Report generated", {
        description: `${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"} included.`,
      });
    } catch (error) {
      setStatusMessage("Report generation failed.");
      toast.error("Couldn't generate the report", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={!uploadedFile || isGenerating}
        aria-busy={isGenerating}
        onClick={() => void handleGenerate()}
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isGenerating ? "Generating…" : "Generate Report"}
      </Button>
      {/* Screen-reader-only live region — announces generation status
          alongside (not instead of) the toast notification above. */}
      <span role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </span>
    </>
  );
}
