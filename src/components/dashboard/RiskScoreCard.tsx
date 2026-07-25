import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RiskScore } from "@/types/evidence";
import { Card, CardContent } from "@/components/ui/card";

const LEVEL_STYLES: Record<RiskScore["level"], { label: string; accent: string; ring: string }> = {
  low: { label: "Low", accent: "bg-severity-normal/15 text-severity-normal", ring: "stroke-severity-normal" },
  medium: { label: "Medium", accent: "bg-severity-warning/15 text-severity-warning", ring: "stroke-severity-warning" },
  high: { label: "High", accent: "bg-severity-critical/15 text-severity-critical", ring: "stroke-severity-critical" },
  critical: { label: "Critical", accent: "bg-severity-critical/20 text-severity-critical", ring: "stroke-severity-critical" },
};

interface RiskScoreCardProps {
  riskScore: RiskScore;
}

/** Case-level risk gauge, derived from suspicious-finding severities (see src/backend/risk-score.ts). */
export function RiskScoreCard({ riskScore }: RiskScoreCardProps) {
  const style = LEVEL_STYLES[riskScore.level];
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - riskScore.score / 100);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {riskScore.score}
            <span className="text-base font-normal text-muted-foreground">/100</span>
          </p>
          <span className={cn("mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", style.accent)}>
            {style.label} risk
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
          <ShieldAlert className={cn("absolute h-5 w-5", style.accent.split(" ")[1])} aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
