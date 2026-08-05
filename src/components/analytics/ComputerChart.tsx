import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Monitor } from "lucide-react";

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

interface ComputerChartProps {
  data: ChartDatum[];
  /** Click-to-filter — reuses `InvestigationFilters.computer`. */
  onSelectComputer?: (computer: string) => void;
}

/**
 * Events by Computer — vertical bar chart of the busiest hosts in the
 * case, pre-sorted/sliced by `aggregation.ts#topN`.
 *
 * Phase 5.8 (UI/UX refinement only): themed grid/axis/cursor, rounded
 * bars, and the shared dark `ChartTooltip` — no change to what's plotted.
 */
export function ComputerChart({ data, onSelectComputer }: ComputerChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard title="Events by Computer" icon={<Monitor className="h-4 w-4" aria-hidden="true" />}>
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
      title="Events by Computer"
      description="Top hosts by event count"
      icon={<Monitor className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="flex h-full flex-col gap-2">
        <div role="img" aria-label={`Events by computer: ${summary}`} className="min-h-0 flex-1">
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
                tick={AXIS_TICK_STYLE}
                axisLine={AXIS_LINE_STYLE}
                tickLine={AXIS_LINE_STYLE}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={48}
                tickFormatter={(value: string) => truncateLabel(value, 12)}
              />
              <YAxis
                allowDecimals={false}
                tick={AXIS_TICK_STYLE}
                axisLine={AXIS_LINE_STYLE}
                tickLine={AXIS_LINE_STYLE}
                width={36}
              />
              <Tooltip cursor={{ fill: CURSOR_FILL }} content={<ChartTooltip colorFor={colorForEntry} />} />
              <Bar
                dataKey="value"
                name="Events"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                isAnimationActive
                animationDuration={400}
                onClick={
                  onSelectComputer
                    ? (entry: { payload?: ChartDatum }) => {
                        if (entry.payload) onSelectComputer(entry.payload.label);
                      }
                    : undefined
                }
                className={onSelectComputer ? "cursor-pointer" : undefined}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={categoricalColor(index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {onSelectComputer && (
          <div className="flex flex-wrap gap-1.5">
            {data.slice(0, 5).map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => onSelectComputer(entry.label)}
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
