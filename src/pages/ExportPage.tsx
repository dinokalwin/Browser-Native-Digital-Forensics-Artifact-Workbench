import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { ExportCenter } from "@/components/export/ExportCenter";

/**
 * Export Center page (Phase 5.11), routed at `/dashboard/export`. Reuses
 * `CaseStateGate` unchanged for the no-case/parse-error/parsing/empty-log
 * branching — same "is a case loaded right now" dependency as the
 * Dashboard, Evidence Viewer, and Timeline pages, unlike `CasesPage.tsx`
 * (Phase 5.10), which deliberately opts out of this gate because a case
 * *library* and a currently-loaded case are unrelated concepts. There's
 * nothing to export without an active investigation, so this page follows
 * the majority pattern instead.
 */
export default function ExportPage() {
  return (
    <CaseStateGate
      title="Export Center"
      description="Upload a case file to export its report, evidence, and intelligence."
    >
      {(events) => <ExportCenter events={events} />}
    </CaseStateGate>
  );
}
