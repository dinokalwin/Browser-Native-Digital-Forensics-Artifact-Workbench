import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Gauge } from "lucide-react";

import type { ChartDatum } from "@/lib/analytics/types";
import { LEVEL_COLOR, formatCount } from "@/lib/analytics/charts";
import type { EventLevel } from "@/types/evidence";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";
import { renderPieActiveShape } from "@/components/analytics/PieActiveShape";

interface EventLevelChartProps {
  data: ChartDatum[];
  /** Click-to-filter (Phase 5.6) — reuses the existing, unmodified
   * `InvestigationFilters.level` field via a callback DashboardPage
   * supplies, rather than this component (or the filtering engine)
   * changing anything about how filtering works. */
  onSelectLevel?: (level: string) => void;
}

function levelColorFor(entry: ChartTooltipEntry): string {
  const label = (entry.payload?.label as EventLevel | undefined) ?? undefined;
  return (label && LEVEL_COLOR[label]) ?? "hsl(var(--muted-foreground))";
}

/**
 * Event Levels Distribution — doughnut chart over every `EventLevel`
 * present in the case (Critical/Error/Warning/Information/Verbose; the
 * real 5-value vocabulary from `types/evidence.ts`, shown in full rather
 * than the 4-level example list in this phase's ticket, since omitting
 * Verbose would hide real data). Colors reuse the same severity tokens as
 * `LevelBadge` elsewhere in the app. A keyboard-reachable button list
 * beneath the chart mirrors each slice for click-to-filter, since raw SVG
 * pie slices aren't natively focusable.
 *
 * Phase 5.8 (UI/UX refinement only): themed custom tooltip, a slightly
 * larger active segment on hover (`renderPieActiveShape`), and
 * dashboard-matched legend typography — no change to what data feeds this
 * chart or how levels are counted.
 */
export function EventLevelChart({ data, onSelectLevel }: EventLevelChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0 || total === 0) {
    return (
      <ChartCard title="Event Levels Distribution" icon={<Gauge className="h-4 w-4" aria-hidden="true" />}>
        <ChartEmptyState />
      </ChartCard>
    );
  }

  const summary = data.map((d) => `${d.label} ${formatCount(d.value)}`).join(", ");

  return (
    <ChartCard
      title="Event Levels Distribution"
      description={`${formatCount(total)} events by level`}
      icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
    >
      <div className="flex h-full flex-col gap-2">
        <div
          role="img"
          aria-label={`Event levels distribution: ${summary}`}
          className="min-h-0 flex-1"
        >
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
                onClick={
                  onSelectLevel
                    ? (entry: { payload?: ChartDatum }) => {
                        if (entry.payload) onSelectLevel(entry.payload.label);
                      }
                    : undefined
                }
                className={onSelectLevel ? "cursor-pointer" : undefined}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={LEVEL_COLOR[entry.label as EventLevel] ?? "hsl(var(--muted-foreground))"}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip colorFor={(entry) => levelColorFor(entry)} />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))", paddingTop: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {onSelectLevel && (
          <div className="flex flex-wrap gap-1.5">
            {data.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => onSelectLevel(entry.label)}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {entry.label} ({formatCount(entry.value)})
              </button>
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
