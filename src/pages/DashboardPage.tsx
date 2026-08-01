import { useCallback, useMemo, useState } from "react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { calculateStatistics } from "@/lib/statistics";
import {
  DEFAULT_FILTERS,
  filterEvents,
  getUniqueComputers,
  getUniqueProviders,
  type InvestigationFilters,
} from "@/lib/eventFilters";
import type { EvtxEvent } from "@/types/evidence";
import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { Card, CardContent } from "@/components/ui/card";
import { StatisticsCards } from "@/components/dashboard/StatisticsCards";
import { FilterToolbar } from "@/components/dashboard/FilterToolbar";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { RiskScoreCard } from "@/components/dashboard/RiskScoreCard";
import { SuspiciousEventsPanel } from "@/components/dashboard/SuspiciousEventsPanel";
import { InvestigationSummaryPanel } from "@/components/dashboard/InvestigationSummaryPanel";
import { EvidenceTable } from "@/components/evidence/EvidenceTable";
import { ExportControls } from "@/components/evidence/ExportControls";
import { EventDetailsDrawer } from "@/components/evidence/EventDetailsDrawer";
import { CaseNotesPanel } from "@/components/notes/CaseNotesPanel";

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
  // Read directly from the store (same pattern as the two selectors above)
  // rather than from CaseStateGate's render-prop argument below, so the
  // memoized calculation is a top-level hook call in DashboardPage itself —
  // calling useMemo inside that nested render-prop callback would attach it
  // to CaseStateGate's render instead, which the rules of hooks disallow.
  const allEvents = useEvidenceStore((s) => s.events);
  const statistics = useMemo(() => calculateStatistics(allEvents), [allEvents]);

  // Investigator Notes (Sprint 4.1) are namespaced per case by the
  // uploaded file's name — see lib/notes.ts. Read here (rather than inside
  // CaseNotesPanel/EventDetailsDrawer directly) so both stay presentation
  // components that just receive `caseId` as a prop.
  const caseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);

  // Dashboard-wide investigation filters (search/provider/computer/eventId/
  // level — see lib/eventFilters.ts). Deliberately separate, component-local
  // state, distinct from filterStore.ts (which drives EvidenceTable's own
  // per-column search/sort/pagination as a finer-grained refinement on top
  // of whatever this narrows the case down to first).
  const [filters, setFilters] = useState<InvestigationFilters>(DEFAULT_FILTERS);

  // Dropdown options are always derived from the full case, not the
  // currently-filtered subset, so narrowing by one field never hides the
  // options needed to broaden back out via another.
  const providers = useMemo(() => getUniqueProviders(allEvents), [allEvents]);
  const computers = useMemo(() => getUniqueComputers(allEvents), [allEvents]);
  const filteredEvents = useMemo(() => filterEvents(allEvents, filters), [allEvents, filters]);

  // Event Details Inspector — local React state per this feature's design
  // (deliberately not Zustand). Kept as two separate pieces of state
  // rather than deriving `open` from `selectedEvent !== null`: closing the
  // drawer only flips `open` to false and leaves `selectedEvent` alone, so
  // the close animation keeps showing the event that was just being
  // viewed instead of the content vanishing mid-animation.
  const [selectedEvent, setSelectedEvent] = useState<EvtxEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Stable references, so EvidenceTable (React.memo-wrapped) doesn't
  // re-render just because DashboardPage re-rendered for an unrelated
  // reason — only an actual prop change (new data/isLoading/onRowClick)
  // should cause that.
  const handleRowClick = useCallback((event: EvtxEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  }, []);
  const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

  return (
    <CaseStateGate
      title="Case Overview"
      description="Upload an EVTX file from the landing page to begin an investigation."
    >
      {(events) => (
        <>
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Investigation Statistics
            </h2>
            {/*
              Breakpoints deliberately skip `xl` (1280px) and jump straight
              from `lg` to `2xl` (1536px): at 1280-1440px ("large laptop"
              range, per this sprint's own 1366/1280 verification
              checkpoints) six columns would squeeze each card too narrow,
              so that range stays at 3 columns / 2 rows like `lg`, and only
              genuinely wide viewports (1536px+, covering the 1600/1920
              checkpoints) expand to a single row of 6.
            */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              <StatisticsCards statistics={statistics} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <RiskScoreCard
              riskScore={investigationSummary?.riskScore ?? { score: 0, level: "low" }}
            />
            <SummaryCards events={filteredEvents} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SuspiciousEventsPanel findings={suspiciousFindings} events={events} />
            {investigationSummary && <InvestigationSummaryPanel summary={investigationSummary} />}
          </div>

          <CaseNotesPanel caseId={caseId} />

          {/*
            Sprint 3.4.1: the whole "All Events" workspace — heading,
            filters, results summary, export actions, and the table itself
            — now lives inside one Card instead of several visually
            disconnected blocks stacked on the page. Internal rhythm is
            standardized on gap-6 (Card content) / gap-4 (toolbar-to-table
            spacing), matching the rest of the dashboard.
          */}
          <Card>
            <CardContent className="flex flex-col gap-6 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                All Events
              </h2>

              <FilterToolbar
                filters={filters}
                onFiltersChange={setFilters}
                providers={providers}
                computers={computers}
              />

              {/*
                Results summary + export actions share one compact row
                (ticket's "Action Toolbar" moved next to the results count,
                actions right-aligned) — matches this sprint's desired
                layout mock exactly: "Showing X of Y Events" regardless of
                whether a filter has actually narrowed the set.
              */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredEvents.length.toLocaleString()} of{" "}
                  {allEvents.length.toLocaleString()} Events
                </p>
                <ExportControls events={filteredEvents} />
              </div>

              <EvidenceTable data={filteredEvents} onRowClick={handleRowClick} showToolbar={false} />
            </CardContent>
          </Card>

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
