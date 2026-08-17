import { useCallback, useState } from "react";

import { useEvidenceStore } from "@/store/evidenceStore";
import type { EvtxEvent } from "@/types/evidence";
import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { EvidenceTable } from "@/components/evidence/EvidenceTable";
import { EventDetailsDrawer } from "@/components/evidence/EventDetailsDrawer";

/**
 * Evidence Table page. Backed by real parsed events from `evidenceStore`.
 *
 * Phase 5 Item 1 — Raw XML Drill-Down. Prior to this, this page rendered
 * `EvidenceTable` with no `onRowClick` and no `EventDetailsDrawer`, so a
 * row click here only set `uiStore.selectedEvent` (the cross-panel
 * highlight link) and did nothing visible — the Evidence Viewer had no way
 * to open a single event's full detail, including its raw XML, even though
 * `EventDetailsDrawer` (and the `EvtxEvent.raw` field it reads) already
 * existed and was already wired into `DashboardPage`. Wiring it in here
 * too — same `selectedEvent`/`isDrawerOpen` local-state pattern
 * `DashboardPage.tsx` already established for this exact drawer — is
 * strictly additive: it does not change `EvidenceTable`'s props/behavior
 * for any other consumer, and this page had no prior drawer behavior to
 * preserve or break.
 */
export default function EvidenceViewerPage() {
  const caseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);
  const [selectedEvent, setSelectedEvent] = useState<EvtxEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRowClick = useCallback((event: EvtxEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  }, []);
  const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <CaseStateGate
      title="Evidence Viewer"
      description="Upload an EVTX file from the landing page to populate the evidence table."
    >
      {(events) => (
        <>
          <EvidenceTable data={events} onRowClick={handleRowClick} />
          <EventDetailsDrawer
            selectedEvent={selectedEvent}
            open={isDrawerOpen}
            onClose={handleDrawerClose}
            caseId={caseId}
          />
        </>
      )}
    </CaseStateGate>
  );
}
