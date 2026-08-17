import type { DetectionFinding } from "@/lib/detection/types";
import type { InvestigationSummary, UploadedFileMeta } from "@/types/evidence";
import type { InvestigationStatistics } from "@/lib/statistics";
import { formatDate, formatDateRange, formatDuration } from "@/lib/statistics";
import { formatFileSize } from "@/lib/utils";
import { countBySeverity } from "@/components/dashboard/RiskScoreCard";
import { REPORT_APP_VERSION } from "@/lib/report";

/** How many findings the one-page summary lists individually before
 * collapsing the rest into a "+N more" line — `iocFindings` arrives
 * already sorted most-severe-first by `engine.ts#runDetectionEngine`, so
 * this is always the N highest-severity findings, not an arbitrary slice.
 * Keeps this genuinely a single printed page for a typical case, unlike
 * the exhaustive, unbounded "Generate Report" PDF (services/report/), which
 * this component is deliberately NOT a duplicate of. */
const MAX_LISTED_FINDINGS = 8;

interface CaseSummaryPrintViewProps {
  uploadedFile: UploadedFileMeta;
  statistics: InvestigationStatistics;
  investigationSummary: InvestigationSummary | null;
  iocFindings: DetectionFinding[];
}

const SEVERITY_LABEL: Record<DetectionFinding["severity"], string> = {
  critical: "Critical",
  warning: "Warning",
  informational: "Informational",
};

/**
 * Phase 5 Item 3 — Printable Case Summary (SDD §7 Nice to Have:
 * "Printable/exportable case summary (formatted single-page report of the
 * dashboard view)"). Deliberately separate from, and much smaller than,
 * the existing "Generate Report" PDF (`lib/report.ts` +
 * `services/report/pdfGenerator.ts`): that feature already delivers an
 * exhaustive, unbounded multi-page investigation report (every finding,
 * every bookmark, every note, full MITRE ATT&CK breakdown) and this item
 * does not extend or duplicate it. This component instead condenses
 * exactly what's already on `DashboardPage`'s screen — case metadata,
 * threat/severity summary, the investigation summary, and the highest-
 * severity findings — into one printable page, matching the SDD's own
 * "report of the dashboard view" description.
 *
 * Pure and presentation-only: every value comes from props DashboardPage
 * already computes/reads from `evidenceStore` (`statistics`,
 * `investigationSummary`, `iocFindings`) — no new aggregation, no new
 * store reads, no recalculated scores. Severity counts reuse
 * `RiskScoreCard`'s own `countBySeverity` rather than re-deriving them.
 *
 * Rendered permanently in the DOM (`hidden print:block` — see
 * DashboardPage.tsx) rather than mounted only when printing, so the
 * browser's print layout engine has real content to paginate the moment
 * `window.print()` is invoked; `print:hidden` on the rest of the
 * dashboard's content (also in DashboardPage.tsx) hides everything else.
 * Every color here is a fixed, non-theme-variable gray/black — deliberately
 * NOT `text-foreground`/`bg-background` (which can resolve to light-on-dark
 * in the app's dark theme) — so the printed page always reads as a
 * plain, document-style report regardless of which theme was active on
 * screen. `break-inside-avoid` on each section discourages a section from
 * being split across a page boundary where the content is short enough to
 * plausibly fit on one page together.
 */
export function CaseSummaryPrintView({
  uploadedFile,
  statistics,
  investigationSummary,
  iocFindings,
}: CaseSummaryPrintViewProps) {
  const severityCounts = countBySeverity(iocFindings);
  const listedFindings = iocFindings.slice(0, MAX_LISTED_FINDINGS);
  const remainingCount = Math.max(0, iocFindings.length - listedFindings.length);

  return (
    <div className="hidden bg-white text-black print:block">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-lg font-bold">DFIR Workbench — Case Summary</h1>
        <p className="mt-1 text-xs text-gray-600">
          {uploadedFile.name} &middot; Generated {formatDate(new Date())} &middot; v
          {REPORT_APP_VERSION}
        </p>
      </header>

      <section className="mb-4 break-inside-avoid">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Case Information
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <SummaryRow label="File name" value={uploadedFile.name} />
          <SummaryRow label="File size" value={formatFileSize(uploadedFile.sizeBytes)} />
          <SummaryRow label="Total events" value={statistics.totalEvents.toLocaleString()} />
          <SummaryRow
            label="Unique providers"
            value={statistics.uniqueProviders.toLocaleString()}
          />
          <SummaryRow
            label="Unique computers"
            value={statistics.uniqueComputers.toLocaleString()}
          />
          <SummaryRow label="Unique event IDs" value={statistics.uniqueEventIds.toLocaleString()} />
          <SummaryRow
            label="Date range"
            value={formatDateRange(statistics.earliestTimestamp, statistics.latestTimestamp)}
          />
          <SummaryRow
            label="Log duration"
            value={formatDuration(statistics.earliestTimestamp, statistics.latestTimestamp)}
          />
        </dl>
      </section>

      <section className="mb-4 break-inside-avoid">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Threat Summary
        </h2>
        {investigationSummary ? (
          <p className="text-sm">
            Threat score{" "}
            <span className="font-semibold">
              {investigationSummary.riskScore.score}/100 ({investigationSummary.riskScore.level})
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-500">Threat score not available for this case.</p>
        )}
        <p className="mt-1 text-sm">
          {severityCounts.critical} critical &middot; {severityCounts.warning} warning &middot;{" "}
          {severityCounts.informational} informational
        </p>
        {investigationSummary && investigationSummary.affectedHosts.length > 0 && (
          <p className="mt-1 text-sm">
            <span className="text-gray-600">Affected hosts: </span>
            {investigationSummary.affectedHosts.join(", ")}
          </p>
        )}
      </section>

      {investigationSummary && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Investigation Summary
          </h2>
          <p className="text-sm font-medium">{investigationSummary.headline}</p>
          <p className="mt-1 text-sm leading-relaxed">{investigationSummary.narrative}</p>
          {investigationSummary.keyFindings.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc text-sm">
              {investigationSummary.keyFindings.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="break-inside-avoid">
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Detection Findings ({iocFindings.length})
        </h2>
        {iocFindings.length === 0 ? (
          <p className="text-sm text-gray-500">No suspicious findings detected for this case.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {listedFindings.map((finding) => (
                <li key={finding.id} className="border-b border-gray-100 pb-1.5 text-sm">
                  <span className="font-medium">[{SEVERITY_LABEL[finding.severity]}]</span>{" "}
                  {finding.title}
                  {finding.mitreTechnique && (
                    <span className="text-gray-500"> &middot; {finding.mitreTechnique}</span>
                  )}
                </li>
              ))}
            </ul>
            {remainingCount > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                +{remainingCount} additional finding{remainingCount === 1 ? "" : "s"} — see the
                Evidence Viewer for the full list.
              </p>
            )}
          </>
        )}
      </section>

      <footer className="mt-4 border-t border-gray-300 pt-2 text-[10px] text-gray-400">
        Generated client-side by DFIR Workbench — no data leaves the browser.
      </footer>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 py-0.5">
      <dt className="text-gray-600">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
