import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Layers } from "lucide-react";

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

interface MitreTacticDistributionProps {
  data: MitreChartDatum[];
  /** Sprint 5.9.2 — the tactic currently driving the cross-filter (either
   * clicked directly on this chart, or implied by a selected technique's
   * own tactic), or `undefined` when nothing is selected. The matching bar
   * gets full opacity + a ring; every other bar dims. */
  selectedLabel?: string;
  /** Sprint 5.9.2 — clicking a bar toggles that tactic into/out of
   * `filters.tactic` (see `MitreAttackPage.tsx#handleToggleTactic`). */
  onSelect?: (label: string) => void;
}

/**
 * Tactic Distribution — horizontal bar chart of IOC findings grouped by
 * MITRE tactic (Sprint 5.9.1, Step 6), built from
 * `lib/mitre/statistics.ts#buildTacticChartData` (itself derived from
 * `lib/mitre/aggregation.ts`'s single pass over `iocFindings` — no event
 * re-scan). Reuses the analytics feature's `ChartCard`/`ChartTooltip`/
 * `ChartEmptyState` and color/axis-style tokens so this page's charts read
 * as visually identical to the Analytics dashboard's, per this sprint's
 * "reuse existing design language" instruction.
 *
 * Sprint 5.9.2 — bars are now clickable (`onSelect`) and dim relative to
 * `selectedLabel`, the same cross-filter pattern used by
 * `MitreTechniqueDistribution`/`MitreSeverityDistribution`. Mouse-only:
 * recharts renders bars as plain SVG `<path>`s with no native keyboard
 * focus, and this project won't fake a `role="button"` onto something
 * that can't actually receive focus (the same reasoning
 * `MitreCoverageMatrix.tsx` documents for its own ARIA choices). The
 * Tactic dropdown in `MitreFilterToolbar` and the Coverage Matrix both
 * offer the identical filter through a fully keyboard-operable control, so
 * this click is a mouse convenience layered on top of an already-accessible
 * path, not the only way to reach it.
 */
export function MitreTacticDistribution({ data, selectedLabel, onSelect }: MitreTacticDistributionProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Tactic Distribution" icon={<Layers className="h-4 w-4" aria-hidden="true" />}>
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
      title="Tactic Distribution"
      description="Findings by MITRE tactic"
      icon={<Layers className="h-4 w-4" aria-hidden="true" />}
    >
      <div role="img" aria-label={`Tactic distribution: ${summary}`} className="h-full">
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
              width={130}
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
