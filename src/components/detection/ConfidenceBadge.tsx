import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ConfidenceLevel } from "@/lib/detection/types";

/** Phase 5.13 — Detection Engine 2.0. Distinct color scale from
 * `level-badge.tsx`'s `LEVEL_VARIANT` / `IOCFindingsPanel`'s
 * `SEVERITY_VARIANT` on purpose: severity ("how bad would this be if
 * real") and confidence ("how sure are we it's real") are different axes,
 * and reusing the same color mapping for both would make a LOW-confidence
 * CRITICAL-severity finding (exactly the "legitimate service" case this
 * phase exists to fix) render as visually alarming as a HIGH-confidence
 * one. The badge's own text label ("LOW CONFIDENCE") is what actually
 * conveys the level — color is never the only signal (ticket section 29). */
const CONFIDENCE_VARIANT: Record<ConfidenceLevel, NonNullable<BadgeProps["variant"]>> = {
  low: "outline",
  medium: "secondary",
  high: "warning",
  critical: "critical",
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  /** 0-100 — shown alongside the level label ("HIGH CONFIDENCE · 62/100"),
   * per this phase's IOC panel example ("LOW CONFIDENCE Risk 18/100"). */
  score?: number;
  className?: string;
}

export function ConfidenceBadge({ level, score, className }: ConfidenceBadgeProps) {
  return (
    <Badge variant={CONFIDENCE_VARIANT[level]} className={className}>
      {level.toUpperCase()} CONFIDENCE{typeof score === "number" ? ` · ${score}/100` : ""}
    </Badge>
  );
}
