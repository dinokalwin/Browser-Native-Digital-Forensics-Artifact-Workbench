import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Crosshair } from "lucide-react";

import type { MitreChartDatum } from "@/lib/mitre/types";
import { getTechniqueInfo } from "@/lib/mitre/mapping";
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

interface MitreTopTechniquesChartProps {
  data: MitreChartDatum[];
}

/**
 * "Top ATT&CK Techniques" (Sprint 5.9.4, Step 7 — Analytics Dashboard).
 * Data comes from `lib/mitre/statistics.ts#buildTechniqueChartDataFromTechniques`
 * — the same builder the MITRE ATT&CK page's Technique Distribution chart
 * already calls — so this is a second call to an existing pure function,
 * not a new aggregation. There is no prior technique-level chart anywhere
 * in Analytics (only the tactic-level `MitreTacticChart`), so this one is
 * entirely additive.
 *
 * Each bar's label is the bare technique ID (`T1110`) to keep the Y-axis
 * narrow, matching every other bar chart in this directory. The chart's
 * `aria-label` summary (screen-reader-only context, not a visible tooltip)
 * resolves each ID's full name via `lib/mitre/mapping.ts#getTechniqueInfo`
 * — the same reference table every other MITRE-aware surface reads from —
 * so a screen reader user isn't left with bare technique IDs the way a
 * sighted user briefly is before hovering.
 */
export function MitreTopTechniquesChart({ data }: MitreTopTechniquesChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Top ATT&CK Techniques"
        icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}
        iconClassName="bg-primary/10 text-primary"
      >
        <ChartEmptyState message="No IOC findings for this case." />
      </ChartCard>
    );
  }

  const summary = data
    .map((d) => `${d.label} (${getTechniqueInfo(d.label)?.name ?? "Unknown"}) ${formatCount(d.value)}`)
    .join(", ");
  const colorForEntry = (entry: ChartTooltipEntry): string | undefined => {
    const label = entry.payload?.label as string | undefined;
    const index = data.findIndex((d) => d.label === label);
    return index >= 0 ? categoricalColor(index) : undefined;
  };

  return (
    <ChartCard
      title="Top ATT&CK Techniques"
      description="Most-triggered techniques by finding volume"
      icon={<Crosshair className="h-4 w-4" aria-hidden="true" />}
      iconClassName="bg-primary/10 text-primary"
    >
      <div role="img" aria-label={`Top ATT&CK techniques: ${summary}`} className="h-full">
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
              width={70}
              tick={{ ...AXIS_TICK_STYLE, fontFamily: "monospace" }}
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
