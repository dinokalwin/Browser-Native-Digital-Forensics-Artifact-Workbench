import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { EventTimeline } from "@/components/timeline/EventTimeline";

export default function TimelinePage() {
  return (
    <CaseStateGate
      title="Timeline"
      description="Upload an EVTX file from the landing page to build a timeline."
    >
      {(events) => <EventTimeline events={events} />}
    </CaseStateGate>
  );
}
