import * as React from "react";
import { BarChart3 } from "lucide-react";

import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type { InvestigationFilters } from "@/lib/eventFilters";
import { aggregateEvents, aggregateThreats, buildTimeSeries, chooseGranularity, topN } from "@/lib/analytics/aggregation";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import { buildTacticChartDataFromTechniques, buildTechniqueChartDataFromTechniques } from "@/lib/mitre/statistics";
import { Card, CardContent } from "@/components/ui/card";
import { EventLevelChart } from "@/components/analytics/EventLevelChart";
import { ProviderChart } from "@/components/analytics/ProviderChart";
import { EventIdChart } from "@/components/analytics/EventIdChart";
import { ComputerChart } from "@/components/analytics/ComputerChart";
import { EventTimelineChart } from "@/components/analytics/EventTimelineChart";
import { ThreatDistributionChart } from "@/components/analytics/ThreatDistributionChart";
import { ConfidenceDistributionChart } from "@/components/analytics/ConfidenceDistributionChart";
import { MitreTacticChart } from "@/components/analytics/MitreTacticChart";
import { MitreTopTacticsChart } from "@/components/analytics/MitreTopTacticsChart";
import { MitreTopTechniquesChart } from "@/components/analytics/MitreTopTechniquesChart";

export interface AnalyticsPanelProps {
  events: EvtxEvent[];
  iocFindings: DetectionFinding[];
  /**
   * Click-to-filter (Phase 5.6). Optional and additive: `DashboardPage`
   * passes a callback that merges the patch into its own existing
   * `InvestigationFilters` state via the existing `onFiltersChange` setter
   * — this component (and the filtering engine itself, `lib/eventFilters.ts`)
   * never changes what filtering means or how it works, it just reuses the
   * existing public shape to request a change.
   */
  onFilterRequest?: (patch: Partial<InvestigationFilters>) => void;
}

/**
 * Interactive Analytics Dashboard (Phase 5.6) — orchestrates all seven
 * charts from exactly two aggregation passes: one over `events`
 * (`aggregateEvents`, single O(n) scan producing every count-by-dimension
 * chart needs) and one over `iocFindings` (`aggregateThreats`, over the
 * IOC Detection Engine's already-computed output, not a re-detection).
 * Both are `useMemo`-d on their source arrays, so re-renders that don't
 * change the underlying case (e.g. opening the Event Details Drawer)
 * never re-aggregate.
 *
 * This component is lazy-loaded from `DashboardPage.tsx` (`React.lazy`),
 * matching the dynamic-import precedent already established for
 * `GenerateReportButton`/`pdfGenerator.ts` — recharts and everything in
 * this directory ship in their own chunk, fetched once the dashboard
 * actually renders rather than bundled into `DashboardPage`'s own chunk.
 */
export function AnalyticsPanel({ events, iocFindings, onFilterRequest }: AnalyticsPanelProps) {
  const aggregation = React.useMemo(() => aggregateEvents(events), [events]);
  const threats = React.useMemo(() => aggregateThreats(iocFindings), [iocFindings]);
  // Sprint 5.9.4, Step 7 — "Top ATT&CK Tactics"/"Top ATT&CK Techniques"
  // charts. A second, independent aggregation over the same `iocFindings`
  // this component already receives — `lib/mitre/aggregation.ts`, not
  // `lib/analytics/aggregation.ts` (protected, unmodified), so this is
  // additive rather than a change to how `threats` above is computed.
  const mitreAggregation = React.useMemo(() => aggregateMitreFindings(iocFindings), [iocFindings]);
  const topTacticsData = React.useMemo(
    () => buildTacticChartDataFromTechniques(mitreAggregation.techniques),
    [mitreAggregation],
  );
  const topTechniquesData = React.useMemo(
    () => buildTechniqueChartDataFromTechniques(mitreAggregation.techniques),
    [mitreAggregation],
  );

  const levelData = React.useMemo(
    () =>
      Array.from(aggregation.levelCounts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
    [aggregation],
  );
  const providerData = React.useMemo(() => topN(aggregation.providerCounts, 10), [aggregation]);
  const eventIdData = React.useMemo(() => topN(aggregation.eventIdCounts, 10), [aggregation]);
  const computerData = React.useMemo(() => topN(aggregation.computerCounts, 10), [aggregation]);
  const granularity = React.useMemo(
    () => chooseGranularity(aggregation.earliestMs, aggregation.latestMs),
    [aggregation],
  );
  const timeSeries = React.useMemo(() => buildTimeSeries(aggregation, granularity), [aggregation, granularity]);

  const handleSelectLevel = React.useCallback(
    (level: string) => onFilterRequest?.({ level: level as InvestigationFilters["level"] }),
    [onFilterRequest],
  );
  const handleSelectProvider = React.useCallback(
    (provider: string) => onFilterRequest?.({ provider }),
    [onFilterRequest],
  );
  const handleSelectComputer = React.useCallback(
    (computer: string) => onFilterRequest?.({ computer }),
    [onFilterRequest],
  );
  const handleSelectEventId = React.useCallback(
    (eventId: number) => onFilterRequest?.({ eventId }),
    [onFilterRequest],
  );

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <BarChart3 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No events available to analyze yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <EventLevelChart data={levelData} onSelectLevel={onFilterRequest ? handleSelectLevel : undefined} />
      <ThreatDistributionChart threats={threats} />
      <ConfidenceDistributionChart findings={iocFindings} />
      <ProviderChart data={providerData} onSelectProvider={onFilterRequest ? handleSelectProvider : undefined} />
      <EventIdChart data={eventIdData} onSelectEventId={onFilterRequest ? handleSelectEventId : undefined} />
      <ComputerChart data={computerData} onSelectComputer={onFilterRequest ? handleSelectComputer : undefined} />
      <MitreTacticChart threats={threats} />
      <MitreTopTacticsChart data={topTacticsData} />
      <MitreTopTechniquesChart data={topTechniquesData} />
      <EventTimelineChart data={timeSeries} granularity={granularity} />
    </div>
  );
}

export default AnalyticsPanel;
