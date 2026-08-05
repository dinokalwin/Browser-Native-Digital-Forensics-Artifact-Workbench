import { ShieldAlert, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RiskScore } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import { Card, CardContent } from "@/components/ui/card";

const LEVEL_STYLES: Record<RiskScore["level"], { label: string; accent: string; ring: string }> = {
  low: {
    label: "Low",
    accent: "bg-severity-normal/15 text-severity-normal",
    ring: "stroke-severity-normal",
  },
  medium: {
    label: "Medium",
    accent: "bg-severity-warning/15 text-severity-warning",
    ring: "stroke-severity-warning",
  },
  high: {
    label: "High",
    accent: "bg-severity-critical/15 text-severity-critical",
    ring: "stroke-severity-critical",
  },
  critical: {
    label: "Critical",
    accent: "bg-severity-critical/20 text-severity-critical",
    ring: "stroke-severity-critical",
  },
};

/**
 * Sprint 5.9.4 — the four MITRE ATT&CK figures this sprint's "Enhance
 * Threat Score" step asks for. Assembled by `DashboardPage` from
 * `lib/mitre`'s existing `computeCoverageStats`/`computeAdvancedMitreStats`
 * (both already memoized there for the MITRE page's own use — this is the
 * same aggregation, not a second computation) rather than duplicated here,
 * keeping this card presentation-only. Optional and purely additive, same
 * convention `iocFindings` below already established: omitted entirely,
 * the card renders exactly as it did before this sprint.
 */
export interface RiskScoreMitreSummary {
  coveragePercent: number;
  criticalTechniqueCount: number;
  topTactic: string | null;
  topTechnique: { id: string; name: string } | null;
}

interface RiskScoreCardProps {
  riskScore: RiskScore;
  /** Phase 5.4 — IOC Detection Engine findings driving this score. Optional
   * and purely additive: when provided, renders a per-severity breakdown
   * row underneath the gauge; when omitted, the card renders exactly as it
   * did before this phase. */
  iocFindings?: DetectionFinding[];
  /** Sprint 5.9.4 — see `RiskScoreMitreSummary` above. */
  mitreSummary?: RiskScoreMitreSummary;
}

function countBySeverity(findings: DetectionFinding[]): Record<DetectionFinding["severity"], number> {
  const counts: Record<DetectionFinding["severity"], number> = { critical: 0, warning: 0, informational: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

/**
 * Case-level Threat Score gauge (Phase 5.4 — relabeled and enhanced from
 * "Risk Score"; see src/lib/detection/engine.ts's `computeThreatScore`,
 * which reuses the existing, unmodified weighting model in
 * src/backend/risk-score.ts over the new 14-rule engine's findings). The
 * `RiskScore` data shape itself is untouched, so `InvestigationSummary`
 * and `lib/report.ts` need no changes — this is a presentation-layer
 * rename plus an optional breakdown row sourced from `iocFindings`.
 */
export function RiskScoreCard({ riskScore, iocFindings, mitreSummary }: RiskScoreCardProps) {
  const style = LEVEL_STYLES[riskScore.level];
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - riskScore.score / 100);
  const counts = iocFindings ? countBySeverity(iocFindings) : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Threat Score</p>
            <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {riskScore.score}
              <span className="text-base font-normal text-muted-foreground">/100</span>
            </p>
            <span
              className={cn(
                "mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                style.accent,
              )}
            >
              {style.label} threat level
            </span>
          </div>
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" strokeWidth="6" className="stroke-muted" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={cn("transition-all duration-700 ease-out", style.ring)}
              />
            </svg>
            <ShieldAlert
              className={cn("absolute h-5 w-5", style.accent.split(" ")[1])}
              aria-hidden="true"
            />
          </div>
        </div>

        {counts && (counts.critical > 0 || counts.warning > 0 || counts.informational > 0) && (
          <div className="flex items-center gap-3 border-t border-border pt-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-severity-critical" aria-hidden="true" />
              {counts.critical} critical
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-severity-warning" aria-hidden="true" />
              {counts.warning} warning
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" aria-hidden="true" />
              {counts.informational} informational
            </span>
          </div>
        )}

        {mitreSummary && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                Coverage <span className="font-medium text-foreground">{mitreSummary.coveragePercent}%</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-severity-critical" aria-hidden="true" />
              <span>
                Critical techniques{" "}
                <span className="font-medium text-foreground">{mitreSummary.criticalTechniqueCount}</span>
              </span>
            </div>
            <div className="min-w-0 truncate text-muted-foreground" title={mitreSummary.topTactic ?? undefined}>
              Top tactic{" "}
              <span className="font-medium text-foreground">{mitreSummary.topTactic ?? "None observed"}</span>
            </div>
            <div
              className="min-w-0 truncate text-muted-foreground"
              title={mitreSummary.topTechnique ? `${mitreSummary.topTechnique.id} — ${mitreSummary.topTechnique.name}` : undefined}
            >
              Top technique{" "}
              <span className="font-medium text-foreground">
                {mitreSummary.topTechnique
                  ? `${mitreSummary.topTechnique.id} — ${mitreSummary.topTechnique.name}`
                  : "None observed"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
