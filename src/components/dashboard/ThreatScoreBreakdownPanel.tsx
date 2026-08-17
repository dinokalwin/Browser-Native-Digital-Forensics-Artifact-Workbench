import { CircleCheck, TrendingUp } from "lucide-react";

import type { ThreatScoreBreakdown } from "@/lib/detection/context/contextScoring";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CATEGORY_ACCENT: Record<ThreatScoreBreakdown["category"], string> = {
  Minimal: "text-severity-normal",
  Low: "text-severity-normal",
  Moderate: "text-severity-warning",
  High: "text-severity-critical",
  Critical: "text-severity-critical",
};

interface ThreatScoreBreakdownPanelProps {
  breakdown: ThreatScoreBreakdown;
}

/**
 * Phase 5.13 — Detection Engine 2.0, ticket section 16: "The Dashboard
 * must show: Overall Threat Score (confidence-adjusted), Critical
 * findings, High/Medium/Low-confidence findings, Top risk factors, Top
 * legitimate activity indicators." Purely presentational — every number
 * here comes pre-computed from `DashboardPage`'s
 * `computeThreatScoreBreakdown(iocFindings, riskScore.score)` call, this
 * component performs no aggregation of its own. Renders nothing useful
 * (an empty-state line) when there are no findings at all, same as every
 * other optional-data dashboard card in this project.
 */
export function ThreatScoreBreakdownPanel({ breakdown }: ThreatScoreBreakdownPanelProps) {
  const totalFindings =
    breakdown.criticalCount + breakdown.highConfidenceCount + breakdown.mediumConfidenceCount + breakdown.lowConfidenceCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
          Threat Score Breakdown
        </CardTitle>
        <CardDescription>
          Why the overall score is what it is — confidence-weighted, not a raw finding count.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {totalFindings === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            <CircleCheck className="mx-auto h-5 w-5 text-severity-normal" aria-hidden="true" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Category</span>
              <span className={`text-sm font-semibold ${CATEGORY_ACCENT[breakdown.category]}`}>{breakdown.category}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-md border border-border p-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-severity-critical">{breakdown.criticalCount}</p>
                <p className="text-muted-foreground">Critical confidence</p>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-severity-warning">{breakdown.highConfidenceCount}</p>
                <p className="text-muted-foreground">High confidence</p>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-foreground">{breakdown.mediumConfidenceCount}</p>
                <p className="text-muted-foreground">Medium confidence</p>
              </div>
              <div className="rounded-md border border-border p-2 text-center">
                <p className="text-lg font-semibold tabular-nums text-muted-foreground">{breakdown.lowConfidenceCount}</p>
                <p className="text-muted-foreground">Low confidence</p>
              </div>
            </div>

            {breakdown.topRiskFactors.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top risk factors</p>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.topRiskFactors.map((factor) => (
                    <Badge key={factor.label} variant="warning" className="text-[10px]">
                      {factor.label} ({factor.occurrences})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {breakdown.topLegitimateIndicators.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Top legitimate activity indicators
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.topLegitimateIndicators.map((factor) => (
                    <Badge key={factor.label} variant="success" className="text-[10px]">
                      {factor.label} ({factor.occurrences})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
