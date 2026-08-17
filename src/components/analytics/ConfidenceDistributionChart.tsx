import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Gauge } from "lucide-react";

import type { ConfidenceLevel, DetectionFinding } from "@/lib/detection/types";
import { CONFIDENCE_LEVEL_COLOR, formatCount } from "@/lib/analytics/charts";
import { ChartCard } from "@/components/analytics/ChartCard";
import { ChartEmptyState } from "@/components/analytics/ChartEmptyState";
import { ChartTooltip, type ChartTooltipEntry } from "@/components/analytics/ChartTooltip";
import { renderPieActiveShape } from "@/components/analytics/PieActiveShape";

interface ConfidenceDistributionChartProps {
  findings: DetectionFinding[];
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const CONFIDENCE_ORDER: ConfidenceLevel[] = ["low", "medium", "high", "critical"];

function confidenceColorFor(entry: ChartTooltipEntry): string {
  const level = entry.payload?.level as ConfidenceLevel | undefined;
  return (level && CONFIDENCE_LEVEL_COLOR[level]) ?? "hsl(var(--muted-foreground))";
}

/**
 * Phase 5.13 — Detection Engine 2.0, ticket section 20: "Update threat
 * analytics to distinguish: Raw detections, High-confidence detections,
 * Critical detections, Low-confidence detections ... Add derived
 * confidence analytics where needed [without modifying] the underlying
 * analytics aggregation." Deliberately a NEW, separate chart (not a change
 * to `ThreatDistributionChart`/`lib/analytics/aggregation.ts`) computing
 * its own tiny one-pass tally over `findings` directly — this is the
 * "derived, additive" analytics this section asks for, distinct from
 * `ThreatDistributionChart`'s existing severity breakdown (confidence and
 * severity are different axes; see `ConfidenceBadge.tsx`'s doc comment).
 */
export function ConfidenceDistributionChart({ findings }: ConfidenceDistributionChartProps) {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);

  const counts = React.useMemo(() => {
    const tally: Record<ConfidenceLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const finding of findings) {
      if (finding.confidenceLevel) tally[finding.confidenceLevel] += 1;
    }
    return tally;
  }, [findings]);

  const data = CONFIDENCE_ORDER.map((level) => ({ label: CONFIDENCE_LABEL[level], value: counts[level], level })).filter(
    (d) => d.value > 0,
  );

  if (data.length === 0) {
    return (
      <ChartCard
        title="Detection Confidence"
        icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
        iconClassName="bg-primary/10 text-primary"
      >
        <ChartEmptyState message="No confidence-scored findings for this case." />
      </ChartCard>
    );
  }

  const totalFindings = data.reduce((sum, d) => sum + d.value, 0);
  const summary = data.map((d) => `${d.label} ${formatCount(d.value)}`).join(", ");

  return (
    <ChartCard
      title="Detection Confidence"
      description={`${formatCount(totalFindings)} findings, by confidence level`}
      icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
      iconClassName="bg-primary/10 text-primary"
    >
      <div role="img" aria-label={`Detection confidence distribution: ${summary}`} className="h-full">
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
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={CONFIDENCE_LEVEL_COLOR[entry.level]} stroke="hsl(var(--card))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip colorFor={(entry) => confidenceColorFor(entry)} />} />
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
