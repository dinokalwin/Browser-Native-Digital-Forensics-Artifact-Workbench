import { useEvidenceStore } from "@/store/evidenceStore";
import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { RiskScoreCard } from "@/components/dashboard/RiskScoreCard";
import { SuspiciousEventsPanel } from "@/components/dashboard/SuspiciousEventsPanel";
import { InvestigationSummaryPanel } from "@/components/dashboard/InvestigationSummaryPanel";
import { EvidenceTable } from "@/components/evidence/EvidenceTable";

/**
 * Case overview (Phase 7). Backed by real parsed events plus the
 * rule-based suspicious-event detection and investigation summary
 * generated in `evidenceStore.loadFile` (see src/backend/*). Both are
 * best-effort — if they haven't finished yet (or, before Phase 7,
 * hadn't been implemented), the panels below simply don't render rather
 * than showing fabricated data.
 */
export default function DashboardPage() {
  const suspiciousFindings = useEvidenceStore((s) => s.suspiciousFindings);
  const investigationSummary = useEvidenceStore((s) => s.investigationSummary);

  return (
    <CaseStateGate
      title="Case Overview"
      description="Upload an EVTX file from the landing page to begin an investigation."
    >
      {(events) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <RiskScoreCard
              riskScore={investigationSummary?.riskScore ?? { score: 0, level: "low" }}
            />
            <SummaryCards events={events} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SuspiciousEventsPanel findings={suspiciousFindings} events={events} />
            {investigationSummary && <InvestigationSummaryPanel summary={investigationSummary} />}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              All Events
            </h2>
            <EvidenceTable data={events} />
          </div>
        </>
      )}
    </CaseStateGate>
  );
}
