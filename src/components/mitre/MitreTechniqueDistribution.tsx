import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Fingerprint } from "lucide-react";

import type { MitreChartDatum } from "@/lib/mitre/types";
import {
  AXIS_LINE_STYLE,
  AXIS_TICK_STYLE,
  CURSOR_FILL,
  GRID_STROKE,
  GRID_STROKE_OPACITY,
  categoricalColor,
  formatCount,
  truncateLabel,
} from "@/lib/analytics/charts";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";

interface MitreTechniqueDistributionProps {
  data: MitreChartDatum[];
  /** Sprint 5.9.2 — the technique ID currently selected (`filters.technique`),
   * or `undefined` when nothing is selected. */
  selectedLabel?: string;
  /** Sprint 5.9.2 — clicking a bar toggles that technique into/out of
   * selection — same handler the Coverage Matrix and Technique Table use
   * (see `MitreAttackPage.tsx#handleToggleTechnique`), so entering
   * "technique mode" from any of the three behaves identically. */
  onSelect?: (label: string) => void;
}

/**
 * Technique Distribution — vertical bar chart of the busiest MITRE
 * techniques observed in this case (Sprint 5.9.1, Step 6; top 10, already
 * sorted/sliced by `lib/mitre/statistics.ts#buildTechniqueChartData`).
 *
 * Not explicitly named in this sprint's Step 2 file list (which only names
 * `MitreTacticDistribution.tsx`), but Step 6 explicitly requires a
 * Technique Distribution chart — the same situation Phase 5.6 hit with
 * `MitreTacticChart.tsx` (required by that sprint's "Dashboard
 * Visualizations" section but absent from its own file list), resolved the
 * same way there: its own file, matching this directory's established
 * one-component-per-chart convention rather than combining three unrelated
 * recharts visualizations into one file.
 */
export function MitreTechniqueDistribution({ data, selectedLabel, onSelect }: MitreTechniqueDistributionProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Technique Distribution" icon={<Fingerprint className="h-4 w-4" aria-hidden="true" />}>
        <ChartEmptyState message="No MITRE-mapped findings for this case." />
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
      title="Technique Distribution"
      description="Top 10 techniques by finding count"
      icon={<Fingerprint className="h-4 w-4" aria-hidden="true" />}
    >
      <div role="img" aria-label={`Technique distribution: ${summary}`} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={GRID_STROKE}
              strokeOpacity={GRID_STROKE_OPACITY}
            />
            <XAxis
              dataKey="label"
              tick={{ ...AXIS_TICK_STYLE, fontFamily: "monospace" }}
              axisLine={AXIS_LINE_STYLE}
              tickLine={AXIS_LINE_STYLE}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={48}
              tickFormatter={(value: string) => truncateLabel(value, 12)}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK_STYLE} axisLine={AXIS_LINE_STYLE} tickLine={AXIS_LINE_STYLE} width={36} />
            <Tooltip cursor={{ fill: CURSOR_FILL }} content={<ChartTooltip colorFor={colorForEntry} />} />
            <Bar
              dataKey="value"
              name="Findings"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              isAnimationActive
              animationDuration={400}
              cursor={onSelect ? "pointer" : undefined}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={categoricalColor(index)}
                  fillOpacity={selectedLabel && selectedLabel !== entry.label ? 0.35 : 1}
                  stroke={selectedLabel === entry.label ? "hsl(var(--primary))" : undefined}
                  strokeWidth={selectedLabel === entry.label ? 2 : 0}
                  onClick={() => onSelect?.(entry.label)}
                  className="transition-opacity duration-300"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
