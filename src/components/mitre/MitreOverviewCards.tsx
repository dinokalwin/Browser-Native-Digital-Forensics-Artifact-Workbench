import { AlertTriangle, Crosshair, Layers, Percent, Target } from "lucide-react";

import type { MitreCoverageStats } from "@/lib/mitre/types";
import { StatCard } from "@/components/dashboard/StatCard";

interface MitreOverviewCardsProps {
  stats: MitreCoverageStats;
}

/**
 * MITRE ATT&CK page's summary metrics (Sprint 5.9.1, Step 5) — five
 * `StatCard`s (the same reusable primitive `StatisticsCards.tsx` uses on
 * the Overview dashboard), reflecting a `MitreCoverageStats` computed
 * once, upstream, by `lib/mitre/statistics.ts#computeCoverageStats`.
 * Purely presentational, matching `StatisticsCards`' own "renders a
 * fragment, the page owns the grid" convention.
 */
export function MitreOverviewCards({ stats }: MitreOverviewCardsProps) {
  return (
    <>
      <StatCard
        label="Total Techniques"
        value={stats.totalTechniquesObserved}
        icon={Target}
        description={`Out of ${stats.totalTechniquesKnown} known to this engine`}
        accentClassName="bg-primary/10 text-primary"
      />
      <StatCard
        label="Unique Tactics"
        value={stats.uniqueTacticsObserved}
        icon={Layers}
        description="Out of 14 ATT&CK tactics"
        accentClassName="bg-severity-normal/15 text-severity-normal"
      />
      <StatCard
        label="IOC Findings"
        value={stats.iocFindingsCount}
        icon={Crosshair}
        description="Total findings from the detection engine"
        accentClassName="bg-muted text-muted-foreground"
      />
      <StatCard
        label="Critical Findings"
        value={stats.criticalFindingsCount}
        icon={AlertTriangle}
        description="Highest-severity MITRE-mapped findings"
        accentClassName="bg-severity-critical/15 text-severity-critical"
      />
      <StatCard
        label="Coverage %"
        value={`${stats.coveragePercent}%`}
        icon={Percent}
        description="Techniques observed / techniques known"
        accentClassName="bg-severity-warning/15 text-severity-warning"
      />
    </>
  );
}
