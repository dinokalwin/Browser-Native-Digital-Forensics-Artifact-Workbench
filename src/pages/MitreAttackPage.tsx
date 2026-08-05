import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";

import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import { useEvidenceStore } from "@/store/evidenceStore";
import { downloadBlob } from "@/lib/download-blob";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import {
  applyHeatmapFilters,
  buildCoverageMatrix,
  buildSeverityChartDataFromTechniques,
  buildTacticChartDataFromTechniques,
  buildTechniqueChartDataFromTechniques,
  computeAdvancedMitreStats,
  computeCoverageStats,
  filterMitreTechniques,
  SEVERITY_BY_LABEL,
  SEVERITY_LABEL,
} from "@/lib/mitre/statistics";
import { buildHeatmapCsvBlob } from "@/lib/mitre/export";
import { exportHeatmapAsPngBlob } from "@/services/mitre/matrixPng";
import type { MitreTactic } from "@/lib/mitre/mapping";
import {
  DEFAULT_MITRE_FILTERS,
  DEFAULT_MITRE_HEATMAP_FILTERS,
  type MitreFilters,
  type MitreHeatmapFilters,
} from "@/lib/mitre/types";
import { CaseStateGate } from "@/components/evidence/CaseStateGate";
import { EventDetailsDrawer } from "@/components/evidence/EventDetailsDrawer";
import { MitreEmptyState } from "@/components/mitre/MitreEmptyState";
import { MitreOverviewCards } from "@/components/mitre/MitreOverviewCards";
import { MitreTacticDistribution } from "@/components/mitre/MitreTacticDistribution";
import { MitreTechniqueDistribution } from "@/components/mitre/MitreTechniqueDistribution";
import { MitreSeverityDistribution } from "@/components/mitre/MitreSeverityDistribution";
import { MitreCoverageMatrix } from "@/components/mitre/MitreCoverageMatrix";
import { MitreCoverageStatsPanel } from "@/components/mitre/MitreCoverageStatsPanel";
import { MitreFilterToolbar } from "@/components/mitre/MitreFilterToolbar";
import { MitreTechniqueTable } from "@/components/mitre/MitreTechniqueTable";
import { MitreFindingDrawer } from "@/components/mitre/MitreFindingDrawer";
import { Card, CardContent } from "@/components/ui/card";

/** Matches `ExportControls.tsx`'s own filename convention (a small,
 * deliberate duplicate rather than an import — that component's helper
 * isn't exported, and this is a three-line function). */
function timestampedFilename(extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `mitre-matrix-export-${stamp}.${extension}`;
}

/**
 * MITRE ATT&CK Intelligence Dashboard (Sprint 5.9.1) — turned into an
 * interactive investigation workspace by Sprint 5.9.2. Maps the IOC
 * Detection Engine's findings (Phase 5.4, `evidenceStore.iocFindings`) onto
 * MITRE ATT&CK techniques and tactics, then lets an analyst cross-filter
 * every section (Coverage Matrix, three charts, Technique Table) from a
 * single filter/selection object and drill into any technique's full
 * detail via a tabbed drawer. Per this sprint's explicit instruction, this
 * page never rescans `events` or re-runs detection: `iocFindings` is
 * already computed once at file-load time (evidenceStore.ts's `loadFiles`,
 * unmodified by this sprint), and every aggregation/filter/chart-rebuild
 * here is a cheap, memoized re-derivation of that one small array — no new
 * pass over `events`.
 *
 * Sprint 5.9.2's single most important architectural decision: there is no
 * separate "selectedTechniqueId" piece of state. `filters.technique` *is*
 * the selection — clicking a technique anywhere (Coverage Matrix, the
 * Technique Distribution chart, or a Technique Table row) all call the
 * same `handleToggleTechnique`, which sets/clears `filters.technique`.
 * That one field simultaneously drives the Coverage Matrix's glow, the
 * Finding Drawer's open/closed state and content, the Technique Table's
 * filtering, and every chart's highlight — "one filter object, every
 * section reacts to it" is what makes this a coherent cross-filtering
 * dashboard instead of nine independent pieces of state that could drift
 * out of sync with each other.
 */
export default function MitreAttackPage() {
  const iocFindings = useEvidenceStore((s) => s.iocFindings);
  const caseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);

  const aggregation = useMemo(() => aggregateMitreFindings(iocFindings), [iocFindings]);
  const coverageStats = useMemo(() => computeCoverageStats(aggregation), [aggregation]);
  const advancedStats = useMemo(() => computeAdvancedMitreStats(aggregation), [aggregation]);
  // The full, unfiltered matrix — every known technique, observed or not.
  // This is what both exports read from (see `MitreMatrixExportControls`'s
  // doc comment: an exported CSV/PNG should be "the matrix", not whatever a
  // display-only Heatmap Filter happens to be hiding on screen right now).
  const coverageMatrix = useMemo(() => buildCoverageMatrix(aggregation), [aggregation]);

  const [filters, setFilters] = useState<MitreFilters>(DEFAULT_MITRE_FILTERS);

  // Sprint 5.9.4, Step 8 — Cross Navigation. A technique badge in the Event
  // Details Drawer, the Timeline, or an IOC Findings card
  // (`navigate("/dashboard/mitre", { state: { focusTechniqueId } })`, see
  // `IOCDetailsSection.tsx`/`TechniqueBadges.tsx`) arrives here as router
  // state rather than a URL param, so this page never needs its own query-
  // string parsing. Consuming it through the same render-time "adjust
  // state" pattern used throughout this file (rather than a `useEffect`)
  // means the very first render that sees a new `focusTechniqueId` already
  // has the right `filters.technique` set — no flash of the unfiltered
  // page before the drawer opens. `consumedFocusTechniqueId` guards against
  // re-applying the same navigation on every subsequent render (e.g. after
  // the analyst manually clears the selection) without needing to mutate
  // or clear the router state itself.
  const location = useLocation();
  const focusTechniqueId = (location.state as { focusTechniqueId?: string } | null)?.focusTechniqueId ?? null;
  const [consumedFocusTechniqueId, setConsumedFocusTechniqueId] = useState<string | null>(null);
  if (focusTechniqueId && focusTechniqueId !== consumedFocusTechniqueId) {
    setConsumedFocusTechniqueId(focusTechniqueId);
    if (filters.technique !== focusTechniqueId) {
      setFilters((f) => ({ ...f, technique: focusTechniqueId }));
    }
  }

  // Sprint 5.9.3, Step 5 — Heatmap Filters. Deliberately a separate
  // controlled object from `filters` (`MitreFilters`) above: these toggles
  // only declutter which cells the Heatmap Matrix *displays*, they don't
  // change the Technique Table's cross-filter/selection semantics — see
  // `MitreHeatmapFilters`'s own doc comment for the full reasoning.
  const [heatmapFilters, setHeatmapFilters] = useState<MitreHeatmapFilters>(DEFAULT_MITRE_HEATMAP_FILTERS);
  const displayedCoverageMatrix = useMemo(
    () => applyHeatmapFilters(coverageMatrix, heatmapFilters),
    [coverageMatrix, heatmapFilters],
  );

  // Sprint 5.9.3, Step 9 — Export. Both handlers read the full, unfiltered
  // `coverageMatrix` (not `displayedCoverageMatrix`) per that component's
  // doc comment. PNG encoding (`canvas.toBlob`) is async, so it gets a
  // small loading flag; CSV building is synchronous string/Blob work and
  // needs none.
  const [isExportingPng, setIsExportingPng] = useState(false);
  const handleExportCsv = useCallback(() => {
    const blob = buildHeatmapCsvBlob(coverageMatrix);
    downloadBlob(blob, timestampedFilename("csv"));
    toast.success("MITRE matrix exported as CSV.");
  }, [coverageMatrix]);
  const handleExportPng = useCallback(() => {
    setIsExportingPng(true);
    exportHeatmapAsPngBlob(coverageMatrix)
      .then((blob) => {
        downloadBlob(blob, timestampedFilename("png"));
        toast.success("MITRE matrix exported as PNG.");
      })
      .catch((error: unknown) => {
        toast.error("Couldn't export the MITRE matrix as PNG.", {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => setIsExportingPng(false));
  }, [coverageMatrix]);

  const hasActiveFilter =
    filters.search.trim() !== "" ||
    filters.tactic !== "All" ||
    filters.severity !== "All" ||
    filters.technique !== "All" ||
    filters.hasRecommendation ||
    filters.hasEvents;

  // Selected technique, resolved from `filters.technique` against the
  // current aggregation — the Coverage Matrix highlight, the drawer, and
  // every chart's "update to the selected technique" behavior all read
  // from this same value, computed once per render rather than three
  // separate times.
  const selectedTechnique = useMemo(
    () =>
      filters.technique !== "All" ? (aggregation.techniques.find((t) => t.id === filters.technique) ?? null) : null,
    [filters.technique, aggregation],
  );

  const [selectedEvent, setSelectedEvent] = useState<EvtxEvent | null>(null);
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const handleSelectEvent = useCallback((event: EvtxEvent) => {
    setSelectedEvent(event);
    setIsEventDrawerOpen(true);
  }, []);
  const handleCloseEventDrawer = useCallback(() => setIsEventDrawerOpen(false), []);

  // Drawer content stays showing the last-selected technique while its own
  // close animation plays (matching `EventDetailsDrawer`'s established
  // convention) — `open` flips false the instant `filters.technique`
  // clears, but the *content* (`lastSelectedTechnique`) only updates when
  // there's a real technique to show, via React's own "adjust state during
  // render" pattern (react.dev/learn/you-might-not-need-an-effect) rather
  // than a `useEffect` + `setState` this repo's React-Compiler-aware lint
  // rules (react-hooks/set-state-in-effect) would flag as a cascading
  // render risk — the same reasoning `EventDetailsDrawer.tsx` and
  // `MitreFindingDrawer.tsx` already document for their own local state.
  const [lastSelectedTechnique, setLastSelectedTechnique] = useState(selectedTechnique);
  if (selectedTechnique && selectedTechnique !== lastSelectedTechnique) {
    setLastSelectedTechnique(selectedTechnique);
  }

  // Clicking a technique anywhere (matrix, technique chart, table row)
  // routes through this one handler — toggling the same ID again clears
  // the selection (Step 1's "Click again clears the selection"), matching
  // this project's "one filter object" design documented above.
  const handleToggleTechnique = useCallback((id: string) => {
    setFilters((f) => ({ ...f, technique: f.technique === id ? "All" : id }));
  }, []);
  // Closing the drawer (X, overlay click, or its own Close button) clears
  // the selection too — there is only one "is a technique selected"
  // concept on this page, so closing its detail view deselects it, the
  // same way collapsing a master-detail layout's detail pane would.
  const handleCloseTechniqueDrawer = useCallback(() => {
    setFilters((f) => ({ ...f, technique: "All" }));
  }, []);

  // Sprint 5.9.3, Step 7 ("Event Synchronization") — selecting an IOC in the
  // drawer. Unlike `handleToggleTechnique`, this never toggles/clears:
  // clicking a finding always *selects* it (and, defensively, asserts its
  // technique is the one selected — normally already true, since every
  // finding shown in the drawer already belongs to `selectedTechnique`).
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const handleSelectFinding = useCallback((finding: DetectionFinding) => {
    setSelectedFindingId(finding.id);
    const techniqueId = finding.mitreTechnique;
    if (techniqueId) {
      setFilters((f) => (f.technique === techniqueId ? f : { ...f, technique: techniqueId }));
    }
  }, []);
  // The finding-level selection only makes sense for whichever technique is
  // currently open in the drawer — reset it (via the same render-time
  // "adjust state" pattern used throughout this file) whenever that
  // technique changes or the drawer closes, rather than leaving a stale
  // `selectedFindingId` highlighted the next time a drawer opens.
  const [lastFindingResetTechniqueId, setLastFindingResetTechniqueId] = useState(selectedTechnique?.id ?? null);
  if ((selectedTechnique?.id ?? null) !== lastFindingResetTechniqueId) {
    setLastFindingResetTechniqueId(selectedTechnique?.id ?? null);
    if (selectedFindingId !== null) setSelectedFindingId(null);
  }

  const handleToggleTactic = useCallback((label: string) => {
    setFilters((f) => ({ ...f, tactic: f.tactic === label ? "All" : (label as MitreTactic) }));
  }, []);

  const handleToggleSeverity = useCallback((label: string) => {
    const severity = SEVERITY_BY_LABEL[label];
    if (!severity) return;
    setFilters((f) => ({ ...f, severity: f.severity === severity ? "All" : severity }));
  }, []);

  // Cross-filter highlight labels: an explicit filter dimension always
  // wins, but with no explicit tactic/severity filter set, a selected
  // technique still implies one (Step 1's "update all charts to the
  // selected technique") — so selecting T1110 highlights "Credential
  // Access" on the Tactic chart and "Critical" on the Severity chart even
  // though neither filter field itself is set.
  const activeTacticLabel = filters.tactic !== "All" ? filters.tactic : selectedTechnique?.tactic;
  const activeSeverityLabel =
    filters.severity !== "All"
      ? SEVERITY_LABEL[filters.severity]
      : selectedTechnique?.highestSeverity
        ? SEVERITY_LABEL[selectedTechnique.highestSeverity]
        : undefined;
  const activeTechniqueLabel = filters.technique !== "All" ? filters.technique : undefined;

  return (
    <CaseStateGate
      title="MITRE ATT&CK"
      description="Upload an EVTX file from the landing page to map detected techniques."
    >
      {(events) => {
        if (iocFindings.length === 0) {
          return <MitreEmptyState />;
        }

        return (
          <MitreAttackWorkspace
            events={events}
            caseId={caseId}
            aggregation={aggregation}
            coverageStats={coverageStats}
            advancedStats={advancedStats}
            coverageMatrix={displayedCoverageMatrix}
            filters={filters}
            onFiltersChange={setFilters}
            hasActiveFilter={hasActiveFilter}
            selectedTechnique={selectedTechnique}
            lastSelectedTechnique={lastSelectedTechnique}
            activeTacticLabel={activeTacticLabel}
            activeSeverityLabel={activeSeverityLabel}
            activeTechniqueLabel={activeTechniqueLabel}
            onToggleTechnique={handleToggleTechnique}
            onToggleTactic={handleToggleTactic}
            onToggleSeverity={handleToggleSeverity}
            onCloseTechniqueDrawer={handleCloseTechniqueDrawer}
            onSelectEvent={handleSelectEvent}
            selectedEvent={selectedEvent}
            isEventDrawerOpen={isEventDrawerOpen}
            onCloseEventDrawer={handleCloseEventDrawer}
            heatmapFilters={heatmapFilters}
            onHeatmapFiltersChange={setHeatmapFilters}
            onExportCsv={handleExportCsv}
            onExportPng={handleExportPng}
            isExportingPng={isExportingPng}
            selectedFindingId={selectedFindingId}
            onSelectFinding={handleSelectFinding}
          />
        );
      }}
    </CaseStateGate>
  );
}

interface MitreAttackWorkspaceProps {
  events: EvtxEvent[];
  caseId: string | null;
  aggregation: ReturnType<typeof aggregateMitreFindings>;
  coverageStats: ReturnType<typeof computeCoverageStats>;
  advancedStats: ReturnType<typeof computeAdvancedMitreStats>;
  coverageMatrix: ReturnType<typeof buildCoverageMatrix>;
  filters: MitreFilters;
  onFiltersChange: (filters: MitreFilters) => void;
  hasActiveFilter: boolean;
  selectedTechnique: ReturnType<typeof aggregateMitreFindings>["techniques"][number] | null;
  lastSelectedTechnique: ReturnType<typeof aggregateMitreFindings>["techniques"][number] | null;
  activeTacticLabel?: string;
  activeSeverityLabel?: string;
  activeTechniqueLabel?: string;
  onToggleTechnique: (id: string) => void;
  onToggleTactic: (label: string) => void;
  onToggleSeverity: (label: string) => void;
  onCloseTechniqueDrawer: () => void;
  onSelectEvent: (event: EvtxEvent) => void;
  selectedEvent: EvtxEvent | null;
  isEventDrawerOpen: boolean;
  onCloseEventDrawer: () => void;
  heatmapFilters: MitreHeatmapFilters;
  onHeatmapFiltersChange: (filters: MitreHeatmapFilters) => void;
  onExportCsv: () => void;
  onExportPng: () => void;
  isExportingPng: boolean;
  selectedFindingId: string | null;
  onSelectFinding: (finding: DetectionFinding) => void;
}

/**
 * Everything below the empty-state check — split out of `MitreAttackPage`
 * so `events` (only available inside `CaseStateGate`'s render-prop) can be
 * a normal prop instead of forcing every hook above to live inside that
 * callback (the Rules of Hooks disallow calling `useMemo` there directly,
 * the same constraint `DashboardPage.tsx` documents for its own
 * top-level-hooks-outside-the-render-prop layout).
 */
function MitreAttackWorkspace({
  events,
  caseId,
  aggregation,
  coverageStats,
  advancedStats,
  coverageMatrix,
  filters,
  onFiltersChange,
  hasActiveFilter,
  selectedTechnique,
  lastSelectedTechnique,
  activeTacticLabel,
  activeSeverityLabel,
  activeTechniqueLabel,
  onToggleTechnique,
  onToggleTactic,
  onToggleSeverity,
  onCloseTechniqueDrawer,
  onSelectEvent,
  selectedEvent,
  isEventDrawerOpen,
  onCloseEventDrawer,
  heatmapFilters,
  onHeatmapFiltersChange,
  onExportCsv,
  onExportPng,
  isExportingPng,
  selectedFindingId,
  onSelectFinding,
}: MitreAttackWorkspaceProps) {
  const knownEventIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

  const filteredTechniques = useMemo(
    () => filterMitreTechniques(aggregation.techniques, filters, knownEventIds),
    [aggregation, filters, knownEventIds],
  );

  const tacticChartData = useMemo(() => buildTacticChartDataFromTechniques(filteredTechniques), [filteredTechniques]);
  const techniqueChartData = useMemo(
    () => buildTechniqueChartDataFromTechniques(filteredTechniques),
    [filteredTechniques],
  );
  const severityChartData = useMemo(
    () => buildSeverityChartDataFromTechniques(filteredTechniques),
    [filteredTechniques],
  );

  const filteredTechniqueIds = useMemo(() => new Set(filteredTechniques.map((t) => t.id)), [filteredTechniques]);

  const resultsKey = filteredTechniques.map((t) => t.id).join("|");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          MITRE Coverage Overview
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <MitreOverviewCards stats={coverageStats} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          ATT&CK Analytics
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <MitreTacticDistribution
            data={tacticChartData}
            selectedLabel={activeTacticLabel}
            onSelect={onToggleTactic}
          />
          <MitreTechniqueDistribution
            data={techniqueChartData}
            selectedLabel={activeTechniqueLabel}
            onSelect={onToggleTechnique}
          />
          <MitreSeverityDistribution
            data={severityChartData}
            selectedLabel={activeSeverityLabel}
            onSelect={onToggleSeverity}
          />
        </div>
      </div>

      <MitreCoverageStatsPanel stats={advancedStats} coverageStats={coverageStats} />

      <MitreCoverageMatrix
        columns={coverageMatrix}
        selectedTechniqueId={selectedTechnique?.id ?? null}
        filteredTechniqueIds={hasActiveFilter ? filteredTechniqueIds : null}
        onToggleTechnique={onToggleTechnique}
        heatmapFilters={heatmapFilters}
        onHeatmapFiltersChange={onHeatmapFiltersChange}
        onExportCsv={onExportCsv}
        onExportPng={onExportPng}
        isExportingPng={isExportingPng}
      />

      <Card>
        <CardContent className="flex flex-col gap-6 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Techniques</h2>

          <MitreFilterToolbar filters={filters} onFiltersChange={onFiltersChange} techniques={aggregation.techniques} />

          {/* Sprint 5.9.2, Step 9 — remounting (via `key`) whenever the
              *set* of visible techniques changes gives a light fade/
              slide-in instead of the table silently snapping to a new row
              count; `resultsKey` only changes when `filteredTechniques`'
              actual composition changes, not on every keystroke that
              doesn't narrow anything further. */}
          <motion.div
            key={resultsKey}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col gap-6"
          >
            <p className="text-sm text-muted-foreground">
              Showing {filteredTechniques.length.toLocaleString()} of{" "}
              {aggregation.techniques.length.toLocaleString()} Techniques
            </p>

            <MitreTechniqueTable
              techniques={filteredTechniques}
              onSelectTechnique={(technique) => onToggleTechnique(technique.id)}
            />
          </motion.div>
        </CardContent>
      </Card>

      <MitreFindingDrawer
        technique={lastSelectedTechnique}
        open={selectedTechnique !== null}
        onClose={onCloseTechniqueDrawer}
        events={events}
        onSelectEvent={onSelectEvent}
        onSelectFinding={onSelectFinding}
        selectedFindingId={selectedFindingId}
      />

      <EventDetailsDrawer
        selectedEvent={selectedEvent}
        open={isEventDrawerOpen}
        onClose={onCloseEventDrawer}
        caseId={caseId}
      />
    </div>
  );
}
