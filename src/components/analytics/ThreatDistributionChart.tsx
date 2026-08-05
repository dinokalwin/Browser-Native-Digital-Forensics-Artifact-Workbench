import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ShieldAlert } from "lucide-react";

import type { ThreatAggregation } from "@/lib/analytics/types";
import type { DetectionFinding } from "@/lib/detection/types";
import { SEVERITY_COLOR, formatCount } from "@/lib/analytics/charts";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";
import { renderPieActiveShape } from "@/components/analytics/PieActiveShape";

interface ThreatDistributionChartProps {
  threats: ThreatAggregation;
}

const SEVERITY_LABEL: Record<DetectionFinding["severity"], string> = {
  critical: "Critical",
  warning: "Warning",
  informational: "Informational",
};

function severityColorFor(entry: ChartTooltipEntry): string {
  const severity = entry.payload?.severity as DetectionFinding["severity"] | undefined;
  return (severity && SEVERITY_COLOR[severity]) ?? "hsl(var(--muted-foreground))";
}

/**
 * Threat Severity Distribution — pie chart over the case's IOC findings
 * (`evidenceStore.iocFindings`, Phase 5.4, unmodified). Uses this app's
 * real severity vocabulary — critical/warning/informational, the three
 * values `DetectionFinding.severity` actually has — rather than the
 * five-tier Critical/High/Medium/Low/Informational example list in this
 * phase's ticket, since that scale isn't backed by any real field in the
 * data model and inventing categories not present in the underlying
 * findings would misrepresent the case to an investigator.
 *
 * Phase 5.8 (UI/UX refinement only): themed custom tooltip, hover-grow
 * active segment, dashboard-matched legend typography — no change to how
 * threats are aggregated or which severities are shown.
 */
export function ThreatDistributionChart({ threats }: ThreatDistributionChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);
  const data = (Object.keys(threats.severityCounts) as Array<DetectionFinding["severity"]>)
    .map((severity) => ({ label: SEVERITY_LABEL[severity], value: threats.severityCounts[severity], severity }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <ChartCard
        title="Threat Severity Distribution"
        icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
        iconClassName="bg-severity-critical/10 text-severity-critical"
      >
        <ChartEmptyState message="No IOC findings for this case." />
      </ChartCard>
    );
  }

  const summary = data.map((d) => `${d.label} ${formatCount(d.value)}`).join(", ");

  return (
    <ChartCard
      title="Threat Severity Distribution"
      description={`${formatCount(threats.totalFindings)} IOC findings`}
      icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
      iconClassName="bg-severity-critical/10 text-severity-critical"
    >
      <div role="img" aria-label={`Threat severity distribution: ${summary}`} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              cornerRadius={4}
              activeIndex={activeIndex}
              activeShape={renderPieActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={SEVERITY_COLOR[entry.severity]}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip colorFor={(entry) => severityColorFor(entry)} />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))", paddingTop: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
