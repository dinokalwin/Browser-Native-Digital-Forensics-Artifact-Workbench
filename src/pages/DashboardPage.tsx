import { useMemo, useState } from "react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { calculateStatistics } from "@/lib/statistics";
import {
  DEFAULT_FILTERS,
  filterEvents,
  getUniqueComputers,
  getUniqueProviders,
  type InvestigationFilters,
} from "@/lib/eventFilters";
import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { StatisticsCards } from "@/components/dashboard/StatisticsCards";
import { FilterToolbar } from "@/components/dashboard/FilterToolbar";
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
  // Read directly from the store (same pattern as the two selectors above)
  // rather than from CaseStateGate's render-prop argument below, so the
  // memoized calculation is a top-level hook call in DashboardPage itself —
  // calling useMemo inside that nested render-prop callback would attach it
  // to CaseStateGate's render instead, which the rules of hooks disallow.
  const allEvents = useEvidenceStore((s) => s.events);
  const statistics = useMemo(() => calculateStatistics(allEvents), [allEvents]);

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

          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              All Events
            </h2>

            <FilterToolbar
              filters={filters}
              onFiltersChange={setFilters}
              providers={providers}
              computers={computers}
              className="mb-3"
            />

            <p className="mb-3 text-sm text-muted-foreground">
              Showing {filteredEvents.length.toLocaleString()} of {allEvents.length.toLocaleString()}{" "}
              events
            </p>

            <EvidenceTable data={filteredEvents} />
          </div>
        </>
      )}
    </CaseStateGate>
  );
}
