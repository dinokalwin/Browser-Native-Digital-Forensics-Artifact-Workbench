import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ListTree } from "lucide-react";

import type { ChartDatum } from "@/lib/analytics/types";
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

interface ProviderChartProps {
  data: ChartDatum[];
  /** Click-to-filter — reuses `InvestigationFilters.provider` via a
   * callback from DashboardPage; the filtering engine itself is untouched. */
  onSelectProvider?: (provider: string) => void;
}

/**
 * Top Event Providers — horizontal bar chart of the 10 busiest providers
 * (already pre-sorted/sliced by `lib/analytics/aggregation.ts#topN`, so
 * this component does no sorting of its own).
 *
 * Phase 5.8 (UI/UX refinement only): themed grid/axis/cursor, rounded
 * bars, and the shared dark `ChartTooltip` — no change to what's plotted.
 */
export function ProviderChart({ data, onSelectProvider }: ProviderChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Top Event Providers" icon={<ListTree className="h-4 w-4" aria-hidden="true" />}>
        <ChartEmptyState />
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
      title="Top Event Providers"
      description="Top 10 by event count"
      icon={<ListTree className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="flex h-full flex-col gap-2">
        <div role="img" aria-label={`Top event providers: ${summary}`} className="min-h-0 flex-1">
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
                tickFormatter={(value: string) => truncateLabel(value, 16)}
              />
              <Tooltip cursor={{ fill: CURSOR_FILL }} content={<ChartTooltip colorFor={colorForEntry} />} />
              <Bar
                dataKey="value"
                name="Events"
                radius={[0, 6, 6, 0]}
                maxBarSize={22}
                isAnimationActive
                animationDuration={400}
                onClick={
                  onSelectProvider
                    ? (entry: { payload?: ChartDatum }) => {
                        if (entry.payload) onSelectProvider(entry.payload.label);
                      }
                    : undefined
                }
                className={onSelectProvider ? "cursor-pointer" : undefined}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={categoricalColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {onSelectProvider && (
          <div className="flex flex-wrap gap-1.5">
            {data.slice(0, 5).map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => onSelectProvider(entry.label)}
                title={entry.label}
                className="max-w-[10rem] truncate rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {truncateLabel(entry.label, 18)} ({formatCount(entry.value)})
              </button>
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
