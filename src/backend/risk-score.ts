/**
 * Deterministic risk scoring for a case, derived from its suspicious
 * findings. Pure function, no I/O — easy to unit test and to swap for a
 * more sophisticated model later without touching callers.
 */
import type { RiskLevel, RiskScore, SuspiciousFinding } from "@/types/evidence";

const WEIGHTS: Record<SuspiciousFinding["severity"], number> = {
  critical: 22,
  warning: 9,
  informational: 2,
};

const LEVEL_THRESHOLDS: Array<{ min: number; level: RiskLevel }> = [
  { min: 75, level: "critical" },
  { min: 45, level: "high" },
  { min: 15, level: "medium" },
  { min: 0, level: "low" },
];

export function computeRiskScore(findings: SuspiciousFinding[]): RiskScore {
  const raw = findings.reduce((sum, f) => sum + WEIGHTS[f.severity], 0);
  const score = Math.min(100, raw);
  const level = LEVEL_THRESHOLDS.find((t) => score >= t.min)?.level ?? "low";
  return { score, level };
}
