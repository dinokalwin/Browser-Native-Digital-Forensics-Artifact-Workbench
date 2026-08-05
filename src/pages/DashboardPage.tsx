import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { calculateStatistics } from "@/lib/statistics";
import {
  DEFAULT_FILTERS,
  filterEvents,
  getUniqueComputers,
  getUniqueProviders,
  getUniqueSourceFiles,
  type InvestigationFilters,
} from "@/lib/eventFilters";
import type { EvtxEvent } from "@/types/evidence";
import { computePerFileStatistics } from "@/lib/multiFile";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import {
  buildMitreSummarySentence,
  computeAdvancedMitreStats,
  computeCoverageStats,
  countCriticalTechniques,
} from "@/lib/mitre/statistics";
import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { Card, CardContent } from "@/components/ui/card";
import { StatisticsCards } from "@/components/dashboard/StatisticsCards";
import { MultiFileSummaryCard } from "@/components/dashboard/MultiFileSummaryCard";
import { FilterToolbar } from "@/components/dashboard/FilterToolbar";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { RiskScoreCard } from "@/components/dashboard/RiskScoreCard";
import { IOCFindingsPanel } from "@/components/detection/IOCFindingsPanel";
import { InvestigationSummaryPanel } from "@/components/dashboard/InvestigationSummaryPanel";
import { EvidenceTable } from "@/components/evidence/EvidenceTable";
import { ExportControls } from "@/components/evidence/ExportControls";
import { EventDetailsDrawer } from "@/components/evidence/EventDetailsDrawer";
import { CaseNotesPanel } from "@/components/notes/CaseNotesPanel";
import { BookmarkedEventsCard } from "@/components/dashboard/BookmarkedEventsCard";
import { useBookmarkMap } from "@/store/bookmarksStore";
import { GenerateReportButton } from "@/components/report/GenerateReportButton";

// Phase 5.6 — lazy-loaded the same way DashboardPage/EvidenceViewerPage/
// TimelinePage already are at the route level (routes/index.tsx, not
// touched here): recharts and every analytics chart component are only
// fetched once the dashboard actually renders, in their own chunk, rather
// than adding to DashboardPage's own chunk. A local Suspense boundary
// (below) covers just this section, so the rest of the dashboard doesn't
// wait on it.
const AnalyticsPanel = lazy(() => import("@/components/analytics/AnalyticsPanel"));

/**
 * Case overview (Phase 7). Backed by real parsed events plus the
 * rule-based suspicious-event detection and investigation summary
 * generated in `evidenceStore.loadFile` (see src/backend/*). Both are
 * best-effort — if they haven't finished yet (or, before Phase 7,
 * hadn't been implemented), the panels below simply don't render rather
 * than showing fabricated data.
 */
export default function DashboardPage() {
  // Phase 5.4 — the modular IOC Detection Engine's own, richer findings
  // (src/lib/detection/), replacing `suspiciousFindings` as what this page
  // renders. `suspiciousFindings` itself is unchanged and still populated
  // (lib/report.ts and the PDF export still read it via evidenceStore
  // directly) — this page just no longer needs it locally.
  const iocFindings = useEvidenceStore((s) => s.iocFindings);
  const investigationSummary = useEvidenceStore((s) => s.investigationSummary);

  // Sprint 5.9.4 — Platform-wide MITRE ATT&CK Integration. Reuses the exact
  // same `lib/mitre` aggregation/statistics functions the MITRE ATT&CK page
  // (MitreAttackPage.tsx) already computes from `iocFindings` — this is a
  // second *call* to those pure functions from a different page, not a
  // second aggregation algorithm, and stays a cheap, memoized re-derivation
  // of the same small array (never a re-scan of `events`), matching this
  // sprint's "Reuse existing aggregation. No duplicate calculations."
  // requirement.
  const mitreAggregation = useMemo(() => aggregateMitreFindings(iocFindings), [iocFindings]);
  const mitreCoverageStats = useMemo(() => computeCoverageStats(mitreAggregation), [mitreAggregation]);
  const mitreAdvancedStats = useMemo(() => computeAdvancedMitreStats(mitreAggregation), [mitreAggregation]);
  const mitreSummary = useMemo(
    () => ({
      coveragePercent: mitreCoverageStats.coveragePercent,
      criticalTechniqueCount: countCriticalTechniques(mitreAggregation),
      topTactic: mitreAdvancedStats.highestRiskTactic,
      topTechnique: mitreAdvancedStats.highestRiskTechnique
        ? { id: mitreAdvancedStats.highestRiskTechnique.id, name: mitreAdvancedStats.highestRiskTechnique.name }
        : null,
    }),
    [mitreCoverageStats, mitreAdvancedStats, mitreAggregation],
  );
  const mitreSummarySentence = useMemo(() => buildMitreSummarySentence(mitreAggregation), [mitreAggregation]);
  // Read directly from the store (same pattern as the two selectors above)
  // rather than from CaseStateGate's render-prop argument below, so the
  // memoized calculation is a top-level hook call in DashboardPage itself —
  // calling useMemo inside that nested render-prop callback would attach it
  // to CaseStateGate's render instead, which the rules of hooks disallow.
  const allEvents = useEvidenceStore((s) => s.events);
  const statistics = useMemo(() => calculateStatistics(allEvents), [allEvents]);

  // Phase 5.7 — Multi-EVTX Investigation. `uploadedFiles` is the new,
  // authoritative per-file list (see evidenceStore.ts); `perFileStatistics`
  // is only computed (and only rendered, below) once more than one file is
  // actually loaded, so a single-file case pays no extra cost and looks
  // exactly as it did before this phase.
  const uploadedFiles = useEvidenceStore((s) => s.uploadedFiles);
  const perFileStatistics = useMemo(
    () => computePerFileStatistics(allEvents, uploadedFiles),
    [allEvents, uploadedFiles],
  );

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
  // Phase 5.7 — Multi-EVTX Investigation. FilterToolbar only renders the
  // Source dropdown once this has more than one entry, so a single-file
  // case's toolbar is unchanged from before this phase.
  const sourceFiles = useMemo(() => getUniqueSourceFiles(allEvents), [allEvents]);
  const filteredEvents = useMemo(() => filterEvents(allEvents, filters), [allEvents, filters]);

  // Event Bookmarks (Sprint 4.2) — "Bookmarked Only" is a second, separate
  // narrowing step layered on top of `filteredEvents`, deliberately kept
  // out of `InvestigationFilters`/`filterEvents` (lib/eventFilters.ts is
  // the filtering engine, out of scope for this sprint). Only the "All
  // Events" table/summary/export below reflects it — the Risk/Summary
  // grid above still reflects `filteredEvents` alone, unchanged.
  const bookmarkMap = useBookmarkMap(caseId);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const visibleEvents = useMemo(
    () => (bookmarkedOnly ? filteredEvents.filter((e) => bookmarkMap[e.id]) : filteredEvents),
    [filteredEvents, bookmarkedOnly, bookmarkMap],
  );

  // Ref for the "All Events" Card so BookmarkedEventsCard's click can
  // scroll it into view after enabling the bookmark filter — see
  // handleViewBookmarked below.
  const allEventsCardRef = useRef<HTMLDivElement>(null);
  const handleViewBookmarked = useCallback(() => {
    setBookmarkedOnly(true);
    allEventsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Phase 5.6 — clicking a chart segment in AnalyticsPanel merges a patch
  // into this page's own existing `filters` state via the same
  // `setFilters` this page already passes to FilterToolbar. Nothing about
  // how filtering itself works changes (lib/eventFilters.ts is untouched);
  // this is just a second UI entry point into the same state, same as
  // BookmarkedEventsCard's click-to-navigate above.
  const handleAnalyticsFilterRequest = useCallback((patch: Partial<InvestigationFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    allEventsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
          {/* Sprint 5.1 — report generation is a case-wide action, so it
              sits above every section rather than inside any one of them. */}
          <div className="flex justify-end">
            <GenerateReportButton />
          </div>

          {/* Phase 5.7 — Multi-EVTX Investigation. Only shown once more than
              one file contributed to this case; a single-file case already
              conveys this via StatisticsCards and the Navbar/CaseStateGate
              filename, so this section is pure redundancy there. */}
          {uploadedFiles.length > 1 && (
            <div>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Evidence Sources
              </h2>
              <MultiFileSummaryCard
                fileCount={uploadedFiles.length}
                mergedEventCount={allEvents.length}
                earliestTimestamp={statistics.earliestTimestamp}
                latestTimestamp={statistics.latestTimestamp}
                perFile={perFileStatistics}
              />
            </div>
          )}

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
              iocFindings={iocFindings}
              mitreSummary={mitreSummary}
            />
            <SummaryCards events={filteredEvents} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <IOCFindingsPanel findings={iocFindings} events={events} />
            {investigationSummary && (
              <InvestigationSummaryPanel
                summary={investigationSummary}
                mitreSummarySentence={iocFindings.length > 0 ? mitreSummarySentence : undefined}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <CaseNotesPanel caseId={caseId} className="sm:col-span-2" />
            <BookmarkedEventsCard caseId={caseId} onView={handleViewBookmarked} />
          </div>

          {/*
            Phase 5.6 — Interactive Analytics Dashboard. Own Suspense
            boundary so the rest of the page (already rendered above) never
            waits on recharts' chunk; a lightweight skeleton fills the same
            grid shape while it loads so the section doesn't jump once the
            real charts mount.
          */}
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Analytics
            </h2>
            <Suspense fallback={<AnalyticsPanelSkeleton />}>
              <AnalyticsPanel
                events={allEvents}
                iocFindings={iocFindings}
                onFilterRequest={handleAnalyticsFilterRequest}
              />
            </Suspense>
          </div>

          {/*
            Sprint 3.4.1: the whole "All Events" workspace — heading,
            filters, results summary, export actions, and the table itself
            — now lives inside one Card instead of several visually
            disconnected blocks stacked on the page. Internal rhythm is
            standardized on gap-6 (Card content) / gap-4 (toolbar-to-table
            spacing), matching the rest of the dashboard.
          */}
          <Card ref={allEventsCardRef}>
            <CardContent className="flex flex-col gap-6 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                All Events
              </h2>

              <FilterToolbar
                filters={filters}
                onFiltersChange={setFilters}
                providers={providers}
                computers={computers}
                sourceFiles={sourceFiles}
                bookmarkedOnly={bookmarkedOnly}
                onBookmarkedOnlyChange={setBookmarkedOnly}
              />

              {/*
                Results summary + export actions share one compact row
                (ticket's "Action Toolbar" moved next to the results count,
                actions right-aligned) — matches this sprint's desired
                layout mock exactly: "Showing X of Y Events" regardless of
                whether a filter has actually narrowed the set. Reflects
                `visibleEvents` (post-bookmark-filter), not just
                `filteredEvents`, so the count/export always match what the
                table below is actually showing.
              */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {visibleEvents.length.toLocaleString()} of{" "}
                  {allEvents.length.toLocaleString()} Events
                </p>
                <ExportControls events={visibleEvents} />
              </div>

              <EvidenceTable data={visibleEvents} onRowClick={handleRowClick} showToolbar={false} />
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

/**
 * Placeholder shown while `AnalyticsPanel`'s chunk (recharts + the seven
 * chart components) is still being fetched — mirrors that section's own
 * responsive grid shape (see AnalyticsPanel.tsx) purely with `Card`/
 * `animate-pulse`, so nothing shifts once the real charts mount in.
 */
function AnalyticsPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {/* Sprint 5.9.4 — grew from 7 to 9 charts (Top ATT&CK Tactics/
          Techniques added to AnalyticsPanel.tsx); this skeleton's count
          follows so the loading placeholder still matches the real grid's
          shape instead of visibly growing once the real charts mount. */}
      {Array.from({ length: 9 }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex h-72 flex-col gap-3 p-6">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="flex-1 animate-pulse rounded bg-muted/60" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
