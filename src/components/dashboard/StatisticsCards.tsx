import type { ReactNode } from "react";
import { Database, Radio, Server, Hash, CalendarRange, Clock, ArrowDown } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import {
  formatDate,
  formatShortDate,
  formatDuration,
  type InvestigationStatistics,
} from "@/lib/statistics";

interface StatisticsCardsProps {
  statistics: InvestigationStatistics;
}

/**
 * Date Range's headline value as two stacked short dates ("Feb 20, 2026" /
 * "Jul 31, 2026") with a small down-arrow between them, instead of one
 * dash-joined string that wraps awkwardly at typical card widths. Falls
 * back to a single date (or "N/A") when there's nothing to range over —
 * a single line never needs the two-line treatment. Deliberately one size
 * step down from StatCard's default `text-3xl` (each line here is
 * `text-2xl`): at the full "largest" size, two stacked dates plus the
 * arrow would make this one card noticeably taller than the other five,
 * which is exactly the "excessive vertical height" this sprint is fixing.
 */
function DateRangeValue({ earliest, latest }: { earliest: Date | null; latest: Date | null }): ReactNode {
  const start = formatShortDate(earliest);
  const end = formatShortDate(latest);

  if (start === "N/A" || end === "N/A") {
    return <span>N/A</span>;
  }

  if (start === end) {
    return <span>{start}</span>;
  }

  return (
    <div className="flex flex-col items-start gap-0.5 text-2xl leading-tight">
      <span>{start}</span>
      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span>{end}</span>
    </div>
  );
}

/**
 * Investigation Statistics Dashboard — six at-a-glance metrics for the
 * currently loaded case. Purely presentational: every value it renders is
 * read straight from the `statistics` prop (computed once, upstream, by
 * `calculateStatistics` in DashboardPage) or produced by the pure
 * `formatDate`/`formatShortDate`/`formatDuration` helpers — no aggregation,
 * filtering, or derivation happens in this component.
 *
 * Renders a fragment rather than its own grid, matching SummaryCards'
 * convention: DashboardPage lays these six cards out in one shared grid
 * alongside (or above/below) the other dashboard panels.
 */
export function StatisticsCards({ statistics }: StatisticsCardsProps) {
  const {
    totalEvents,
    uniqueProviders,
    uniqueComputers,
    uniqueEventIds,
    earliestTimestamp,
    latestTimestamp,
  } = statistics;

  return (
    <>
      <StatCard
        label="Total Events"
        value={totalEvents}
        icon={Database}
        description="Parsed from the loaded EVTX file"
        accentClassName="bg-primary/10 text-primary"
      />
      <StatCard
        label="Unique Providers"
        value={uniqueProviders}
        icon={Radio}
        description="Distinct event sources"
        accentClassName="bg-severity-normal/15 text-severity-normal"
      />
      <StatCard
        label="Unique Computers"
        value={uniqueComputers}
        icon={Server}
        description="Distinct hostnames"
        accentClassName="bg-severity-normal/15 text-severity-normal"
      />
      <StatCard
        label="Unique Event IDs"
        value={uniqueEventIds}
        icon={Hash}
        description="Distinct event types"
        accentClassName="bg-muted text-muted-foreground"
      />
      <StatCard
        label="Date Range"
        value={<DateRangeValue earliest={earliestTimestamp} latest={latestTimestamp} />}
        icon={CalendarRange}
        description={`First: ${formatDate(earliestTimestamp)} · Last: ${formatDate(latestTimestamp)}`}
        accentClassName="bg-severity-warning/15 text-severity-warning"
      />
      <StatCard
        label="Log Duration"
        value={formatDuration(earliestTimestamp, latestTimestamp)}
        icon={Clock}
        description="Span from first to last event"
        accentClassName="bg-severity-warning/15 text-severity-warning"
      />
    </>
  );
}
