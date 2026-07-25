import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { EvidenceTable } from "@/components/evidence/EvidenceTable";

/**
 * Evidence Table page. Backed by real parsed events from `evidenceStore`.
 */
export default function EvidenceViewerPage() {
  return (
    <CaseStateGate
      title="Evidence Viewer"
      description="Upload an EVTX file from the landing page to populate the evidence table."
    >
      {(events) => <EvidenceTable data={events} />}
    </CaseStateGate>
  );
}
