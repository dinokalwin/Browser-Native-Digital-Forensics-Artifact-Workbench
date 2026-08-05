import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ShieldAlert } from "lucide-react";

import type { MitreChartDatum } from "@/lib/mitre/types";
import { SEVERITY_BY_LABEL } from "@/lib/mitre/statistics";
import { SEVERITY_COLOR, formatCount } from "@/lib/analytics/charts";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";
import { renderPieActiveShape } from "@/components/analytics/PieActiveShape";

interface MitreSeverityDistributionProps {
  data: MitreChartDatum[];
  /** Sprint 5.9.2 — the chart-label form ("Critical"/"Warning"/
   * "Informational") of the currently selected severity, or `undefined`.
   * Kept in the chart's own label form (not `DetectionFinding["severity"]`)
   * so this component doesn't need to know about `MitreFilters` — the page
   * does the label<->severity mapping when wiring `onSelect`. */
  selectedLabel?: string;
  /** Sprint 5.9.2 — clicking a segment reports its label; the page maps it
   * back to a `DetectionFinding["severity"]` via
   * `lib/mitre/statistics.ts#SEVERITY_BY_LABEL` before toggling
   * `filters.severity`. */
  onSelect?: (label: string) => void;
}

function severityColorFor(entry: ChartTooltipEntry): string {
  const label = entry.payload?.label as string | undefined;
  const severity = label ? SEVERITY_BY_LABEL[label] : undefined;
  return (severity && SEVERITY_COLOR[severity]) ?? "hsl(var(--muted-foreground))";
}

/**
 * Severity Distribution — donut chart of MITRE-mapped findings by severity
 * (Sprint 5.9.1, Step 6). Not explicitly named in Step 2's file list — see
 * `MitreTechniqueDistribution.tsx`'s doc comment for why this sprint adds
 * it as its own file anyway (Step 6 requires it; this codebase's analytics
 * charts are always one component per chart).
 *
 * Reuses the same donut treatment (`renderPieActiveShape` hover-grow,
 * `ChartTooltip`, legend typography) Phase 5.8 established for the
 * Analytics dashboard's own severity/level donuts.
 *
 * Sprint 5.9.2 — segments are clickable (`onSelect`) and dim relative to
 * `selectedLabel`; see `MitreTacticDistribution.tsx`'s doc comment for why
 * this is a mouse-only enhancement layered on top of the Severity dropdown
 * in `MitreFilterToolbar`, which offers the identical filter with full
 * keyboard support.
 */
export function MitreSeverityDistribution({ data, selectedLabel, onSelect }: MitreSeverityDistributionProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);

  if (data.length === 0) {
    return (
      <ChartCard
        title="Severity Distribution"
        icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
        iconClassName="bg-severity-critical/10 text-severity-critical"
      >
        <ChartEmptyState message="No MITRE-mapped findings for this case." />
      </ChartCard>
    );
  }

  const summary = data.map((d) => `${d.label} ${formatCount(d.value)}`).join(", ");

  return (
    <ChartCard
      title="Severity Distribution"
      description={`${formatCount(data.reduce((sum, d) => sum + d.value, 0))} MITRE-mapped findings`}
      icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
      iconClassName="bg-severity-critical/10 text-severity-critical"
    >
      <div role="img" aria-label={`Severity distribution: ${summary}`} className="h-full">
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
              cursor={onSelect ? "pointer" : undefined}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={SEVERITY_COLOR[SEVERITY_BY_LABEL[entry.label] ?? "informational"]}
                  fillOpacity={selectedLabel && selectedLabel !== entry.label ? 0.35 : 1}
                  stroke={selectedLabel === entry.label ? "hsl(var(--primary))" : "hsl(var(--card))"}
                  strokeWidth={selectedLabel === entry.label ? 3 : 2}
                  onClick={() => onSelect?.(entry.label)}
                  className="transition-opacity duration-300"
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
