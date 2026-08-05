import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert } from "lucide-react";

import type { MitreChartDatum } from "@/lib/mitre/types";
import {
  AXIS_LINE_STYLE,
  AXIS_TICK_STYLE,
  CURSOR_FILL,
  GRID_STROKE,
  GRID_STROKE_OPACITY,
  categoricalColor,
  formatCount,
} from "@/lib/analytics/charts";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";

interface MitreTopTacticsChartProps {
  data: MitreChartDatum[];
}

/**
 * "Top ATT&CK Tactics" (Sprint 5.9.4, Step 7 — Analytics Dashboard). Data
 * comes from `lib/mitre/statistics.ts#buildTacticChartDataFromTechniques`,
 * the same pure builder the MITRE ATT&CK page's own Tactic Distribution
 * chart already calls — `AnalyticsPanel` just calls it a second time with
 * this page's own `mitreAggregation.techniques`, not a new aggregation.
 * Distinct from the existing `MitreTacticChart` ("MITRE ATT&CK Coverage"),
 * which sources its counts from `lib/analytics/aggregation.ts`'s own
 * smaller, chart-scoped tactic lookup (protected, unmodified by this
 * sprint) — this chart instead reuses the platform-wide `lib/mitre`
 * technique reference table, matching this sprint's "Integrate MITRE
 * ATT&CK intelligence throughout" objective.
 *
 * Visual structure intentionally mirrors `MitreTacticChart` (same axis/
 * grid/tooltip theming, same horizontal-bar layout) for consistency
 * between the two MITRE-flavored analytics charts.
 */
export function MitreTopTacticsChart({ data }: MitreTopTacticsChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Top ATT&CK Tactics"
        icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
        iconClassName="bg-severity-critical/10 text-severity-critical"
      >
        <ChartEmptyState message="No IOC findings for this case." />
      </ChartCard>
    );
  }

  const summary = data.map((d) => `${d.label} ${formatCount(d.value)}`).join(", ");
  const colorForEntry = (entry: ChartTooltipEntry): string | undefined => {
    const label = entry.payload?.label as string | undefined;
    const index = data.findIndex((d) => d.label === label);
    return index >= 0 ? categoricalColor(index) : undefined;
  };

  return (
    <ChartCard
      title="Top ATT&CK Tactics"
      description="Techniques by tactic, ranked by finding volume"
      icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
      iconClassName="bg-severity-critical/10 text-severity-critical"
    >
      <div role="img" aria-label={`Top ATT&CK tactics: ${summary}`} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke={GRID_STROKE}
              strokeOpacity={GRID_STROKE_OPACITY}
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={AXIS_TICK_STYLE}
              axisLine={AXIS_LINE_STYLE}
              tickLine={AXIS_LINE_STYLE}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={AXIS_TICK_STYLE}
              axisLine={AXIS_LINE_STYLE}
              tickLine={AXIS_LINE_STYLE}
            />
            <Tooltip cursor={{ fill: CURSOR_FILL }} content={<ChartTooltip colorFor={colorForEntry} />} />
            <Bar
              dataKey="value"
              name="Findings"
              radius={[0, 6, 6, 0]}
              maxBarSize={22}
              isAnimationActive
              animationDuration={400}
            >
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={categoricalColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
