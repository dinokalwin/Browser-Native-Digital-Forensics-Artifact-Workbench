import { Folders, Gauge, ShieldAlert, FileClock } from "lucide-react";

import type { CaseLibraryStats } from "@/lib/cases/types";
import { StatCard } from "@/components/dashboard/StatCard";

interface CaseStatisticsProps {
  stats: CaseLibraryStats;
}

/**
 * Case Library header statistics (Phase 5.10) — Total Cases, Average
 * Threat Score, Total Events, Total Findings. Reuses the Dashboard's own
 * `StatCard` (`components/dashboard/StatCard.tsx`) rather than a new stat
 * card component, so the Case Library reads as the same visual family as
 * the Investigation Statistics row on `/dashboard`. `stats` is computed
 * once by `lib/cases/statistics.ts#computeCaseLibraryStats` and passed in
 * — this component only renders it.
 */
export function CaseStatistics({ stats }: CaseStatisticsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Cases"
        value={stats.totalCases}
        icon={Folders}
        accentClassName="bg-primary/10 text-primary"
      />
      <StatCard
        label="Average Threat Score"
        value={`${stats.averageThreatScore}/100`}
        icon={Gauge}
        accentClassName="bg-severity-warning/15 text-severity-warning"
      />
      <StatCard
        label="Total Events"
        value={stats.totalEvents}
        icon={FileClock}
        accentClassName="bg-severity-normal/15 text-severity-normal"
      />
      <StatCard
        label="Total Findings"
        value={stats.totalFindings}
        icon={ShieldAlert}
        accentClassName="bg-severity-critical/10 text-severity-critical"
      />
    </div>
  );
}
