import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Crosshair } from "lucide-react";

import type { ThreatAggregation } from "@/lib/analytics/types";
import {
  AXIS_LINE_STYLE,
  AXIS_TICK_STYLE,
  CURSOR_FILL,
  GRID_STROKE,
  GRID_STROKE_OPACITY,
  categoricalColor,
  formatCount,
} from "@/lib/analytics/charts";
import { topN } from "@/lib/analytics/aggregation";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";

interface MitreTacticChartProps {
  threats: ThreatAggregation;
}

/**
 * MITRE ATT&CK Coverage — bar chart of IOC findings grouped by tactic
 * (visualization #7 in this phase's ticket; not listed in the ticket's
 * "Create src/components/analytics/" file list, but required by the
 * "Dashboard Visualizations" section, so it gets its own file matching the
 * naming convention of the other six). Tactic is resolved from each
 * finding's `mitreTechnique` via a small chart-scoped lookup in
 * `lib/analytics/aggregation.ts` — not a general MITRE engine, and doesn't
 * touch the IOC Detection Engine's own rule files.
 *
 * Phase 5.8 (UI/UX refinement only): themed grid/axis/cursor, rounded
 * bars, and the shared dark `ChartTooltip` — no change to how tactics are
 * counted.
 */
export function MitreTacticChart({ threats }: MitreTacticChartProps) {
  const data = topN(threats.tacticCounts, 10);

  if (data.length === 0) {
    return (
      <ChartCard
        title="MITRE ATT&CK Coverage"
        icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}
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
      title="MITRE ATT&CK Coverage"
      description="Findings by tactic"
      icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}
      iconClassName="bg-severity-critical/10 text-severity-critical"
    >
      <div role="img" aria-label={`MITRE ATT&CK coverage by tactic: ${summary}`} className="h-full">
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
