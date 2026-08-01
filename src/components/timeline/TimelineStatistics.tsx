import { Database, Star, StickyNote, Clock } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import type { TimelineStatistics as TimelineStatisticsData } from "@/lib/timeline";

export interface TimelineStatisticsProps {
  statistics: TimelineStatisticsData;
}

/**
 * Four-card summary row for the Timeline page (Sprint 4.3) — reuses the
 * same `StatCard` presentation component as the Dashboard's Investigation
 * Statistics, for visual consistency, fed by `lib/timeline.ts`'s own
 * `calculateTimelineStatistics` (which itself reuses
 * `lib/statistics.ts::calculateStatistics` rather than duplicating it).
 * Purely presentational — no computation happens in this component.
 */
export function TimelineStatistics({ statistics }: TimelineStatisticsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Events" value={statistics.totalEvents} icon={Database} />
      <StatCard
        label="Bookmarked Events"
        value={statistics.bookmarkedEvents}
        icon={Star}
        accentClassName="bg-primary/10 text-primary"
      />
      <StatCard
        label="Events With Notes"
        value={statistics.eventsWithNotes}
        icon={StickyNote}
        accentClassName="bg-primary/10 text-primary"
      />
      <StatCard
        label="Timeline Span"
        value={statistics.spanDuration}
        description={statistics.spanRange}
        icon={Clock}
      />
    </div>
  );
}
