import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";

import type { TimeGranularity, TimeSeriesPoint } from "@/lib/analytics/types";
import { AXIS_LINE_STYLE, AXIS_TICK_STYLE, formatCount } from "@/lib/analytics/charts";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip } from "@/components/analytics/ChartTooltip";

interface EventTimelineChartProps {
  data: TimeSeriesPoint[];
  granularity: TimeGranularity;
}

/**
 * Events Over Time — line chart, bucketed per hour or per day depending on
 * the case's actual span (`lib/analytics/aggregation.ts#chooseGranularity`).
 * No click-to-filter: `InvestigationFilters` (the existing, unmodified
 * filtering engine) has no date-range field, so a time-bucket click has no
 * corresponding filter to drive — attempting one would mean touching the
 * protected filtering engine, which this phase must not do.
 *
 * Phase 5.8 (UI/UX refinement only): a smoother curve, a larger active
 * point on hover, the shared dark `ChartTooltip`, themed axes, and only
 * horizontal gridlines (vertical lines on a dense time series just add
 * clutter) — no change to how buckets are computed.
 */
export function EventTimelineChart({ data, granularity }: EventTimelineChartProps) {
  if (data.length === 0) {
    return (
      <ChartCard
        title="Events Over Time"
        icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
        className="sm:col-span-2 xl:col-span-3"
      >
        <ChartEmptyState />
      </ChartCard>
    );
  }

  const total = data.reduce((sum, p) => sum + p.count, 0);
  const summary = `${formatCount(total)} events across ${data.length} ${granularity === "hour" ? "hourly" : "daily"} buckets, from ${data[0].label} to ${data[data.length - 1].label}`;

  return (
    <ChartCard
      title="Events Over Time"
      description={`Per-${granularity} event volume`}
      icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
      className="sm:col-span-2 xl:col-span-3"
    >
      <div role="img" aria-label={summary} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="eventTimelineFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK_STYLE}
              axisLine={AXIS_LINE_STYLE}
              tickLine={AXIS_LINE_STYLE}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK_STYLE} axisLine={AXIS_LINE_STYLE} tickLine={AXIS_LINE_STYLE} width={40} />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              content={<ChartTooltip colorFor={() => "hsl(var(--primary))"} />}
            />
            <Area
              type="natural"
              dataKey="count"
              name="Events"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#eventTimelineFade)"
              dot={data.length <= 60 ? { r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 } : false}
              activeDot={{ r: 6, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
