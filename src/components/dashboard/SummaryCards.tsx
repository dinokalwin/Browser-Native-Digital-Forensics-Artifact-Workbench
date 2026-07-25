import * as React from "react";
import { Database, ShieldAlert, TriangleAlert, Info } from "lucide-react";

import type { EvtxEvent } from "@/types/evidence";
import { StatCard } from "@/components/dashboard/StatCard";

interface SummaryCardsProps {
  events: EvtxEvent[];
}

/**
 * Total / Critical / Warning / Information stat cards for the currently
 * loaded event set. Deliberately renders a fragment, not its own grid —
 * DashboardPage lays these out alongside RiskScoreCard in one unified
 * grid rather than nesting a 4-col grid inside a 5-col grid's column.
 */
export function SummaryCards({ events }: SummaryCardsProps) {
  const counts = React.useMemo(() => {
    const total = events.length;
    const critical = events.filter((e) => e.level === "Critical").length;
    const warning = events.filter((e) => e.level === "Warning").length;
    const information = events.filter((e) => e.level === "Information").length;
    return { total, critical, warning, information };
  }, [events]);

  const percentOf = (count: number) =>
    counts.total === 0 ? "0% of total" : `${Math.round((count / counts.total) * 100)}% of total`;

  return (
    <>
      <StatCard
        label="Total Events"
        value={counts.total}
        icon={Database}
        description="Across all providers and hosts"
        accentClassName="bg-primary/10 text-primary"
      />
      <StatCard
        label="Critical Events"
        value={counts.critical}
        icon={ShieldAlert}
        description={percentOf(counts.critical)}
        accentClassName="bg-severity-critical/15 text-severity-critical"
      />
      <StatCard
        label="Warning Events"
        value={counts.warning}
        icon={TriangleAlert}
        description={percentOf(counts.warning)}
        accentClassName="bg-severity-warning/15 text-severity-warning"
      />
      <StatCard
        label="Information Events"
        value={counts.information}
        icon={Info}
        description={percentOf(counts.information)}
        accentClassName="bg-muted text-muted-foreground"
      />
    </>
  );
}
