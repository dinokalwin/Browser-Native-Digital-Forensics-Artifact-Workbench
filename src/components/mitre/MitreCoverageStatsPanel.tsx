import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Crosshair, Flame, Gauge, Percent, Target, TrendingUp } from "lucide-react";

import type { MitreAdvancedStats, MitreCoverageStats } from "@/lib/mitre/types";
import { SEVERITY_LABEL } from "@/lib/mitre/statistics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface MitreCoverageStatsPanelProps {
  stats: MitreAdvancedStats;
  /** Sprint 5.9.3 — Matrix Statistics adds Coverage % and Total Techniques
   * Observed alongside the Sprint 5.9.2 callouts below; both numbers
   * already exist in `MitreCoverageStats` (computed once, shown again at
   * the top of the page via `MitreOverviewCards`) rather than being
   * recomputed here — this panel just also surfaces them next to the
   * matrix for scannability, per this sprint's "Matrix Statistics" list. */
  coverageStats: MitreCoverageStats;
}

interface StatCalloutProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  children: React.ReactNode;
}

function StatCallout({ icon: Icon, iconClassName, label, children }: StatCalloutProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconClassName}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Coverage Statistics (Sprint 5.9.2, Step 8) — a per-tactic coverage
 * breakdown (Observed % / Unobserved % as a two-segment bar) plus headline
 * callouts. Built entirely from `lib/mitre/statistics.ts#computeAdvancedMitreStats`
 * (and, as of Sprint 5.9.3, `computeCoverageStats`), itself a small,
 * bounded (<=14-tactic) derivation over the same `MitreAggregation` every
 * other section of this page already has in hand — no new scan of
 * `iocFindings`, and deliberately *not* affected by the Technique Table's
 * cross-filters (see that function's doc comment): this panel answers "how
 * well-covered is this case overall", which shouldn't change just because
 * an analyst narrowed the table to one severity.
 *
 * Sprint 5.9.3, Step 8 ("Matrix Statistics") extends the callout row from
 * two to five: Coverage %, Total Techniques Observed, Highest Risk Tactic,
 * Highest Risk Technique, and Average Severity — the full list that
 * sprint's ticket names, gathered into one row next to the Heatmap Matrix
 * rather than scattered across the page.
 */
export function MitreCoverageStatsPanel({ stats, coverageStats }: MitreCoverageStatsPanelProps) {
  const { byTactic, highestRiskTactic, mostFrequentTechnique, highestRiskTechnique, averageSeverity } = stats;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <TrendingUp className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold text-foreground">Matrix Statistics</CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            How much of this engine's known technique set this case actually triggered, tactic by tactic.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <StatCallout icon={Percent} iconClassName="bg-primary/10 text-primary" label="Coverage %">
            <p className="mt-0.5 text-sm font-medium text-foreground">{coverageStats.coveragePercent}%</p>
          </StatCallout>

          <StatCallout icon={Target} iconClassName="bg-severity-normal/15 text-severity-normal" label="Techniques Observed">
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {coverageStats.totalTechniquesObserved} of {coverageStats.totalTechniquesKnown}
            </p>
          </StatCallout>

          <StatCallout icon={Flame} iconClassName="bg-severity-critical/10 text-severity-critical" label="Highest Risk Tactic">
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">
              {highestRiskTactic ?? "None observed"}
            </p>
          </StatCallout>

          <StatCallout icon={Gauge} iconClassName="bg-severity-critical/10 text-severity-critical" label="Highest Risk Technique">
            {highestRiskTechnique ? (
              <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={highestRiskTechnique.name}>
                <span className="font-mono text-xs text-muted-foreground">{highestRiskTechnique.id}</span>{" "}
                {highestRiskTechnique.name}
              </p>
            ) : (
              <p className="mt-0.5 text-sm font-medium text-foreground">None observed</p>
            )}
          </StatCallout>

          <StatCallout icon={Crosshair} iconClassName="bg-severity-warning/15 text-severity-warning" label="Average Severity">
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {averageSeverity.label ? `${SEVERITY_LABEL[averageSeverity.label]} (${averageSeverity.score.toFixed(2)})` : "None observed"}
            </p>
          </StatCallout>
        </div>

        <StatCallout icon={Crosshair} iconClassName="bg-primary/10 text-primary" label="Most Frequent Technique">
          {mostFrequentTechnique ? (
            <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={mostFrequentTechnique.name}>
              <span className="font-mono text-xs text-muted-foreground">{mostFrequentTechnique.id}</span>{" "}
              {mostFrequentTechnique.name}
            </p>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-foreground">None observed</p>
          )}
        </StatCallout>

        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Coverage by Tactic
          </h3>
          <ul className="flex flex-col gap-2.5">
            {byTactic.map((entry) => (
              <li key={entry.tactic} className="flex items-center gap-3">
                <span className="w-36 shrink-0 truncate text-xs text-foreground" title={entry.tactic}>
                  {entry.tactic}
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${entry.tactic}: ${entry.observedPercent}% observed, ${entry.unobservedPercent}% unobserved (${entry.observedCount} of ${entry.totalCount} techniques)`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${entry.observedPercent}%` }}
                  />
                </div>
                <Badge variant="outline" className="w-16 shrink-0 justify-center font-mono text-[10px]">
                  {entry.observedCount}/{entry.totalCount}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
