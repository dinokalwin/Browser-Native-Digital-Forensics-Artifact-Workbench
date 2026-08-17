/**
 * Phase 2 — Automated Test Foundation (SDD §24 item 3). `computeRiskScore`
 * is a pure function — every case below is expressed as an exact expected
 * number, derived directly from the documented formula in risk-score.ts's
 * own header comment (severity cap x confidence fraction, grouped by
 * `${title}:${confidenceLevel ?? severity}`, averaged within a group, then
 * scaled by `1 + log2(count)` for a repeated group).
 */
import { describe, expect, it } from "vitest";
import { computeRiskScore } from "../risk-score";
import type { SuspiciousFinding } from "@/types/evidence";

let idCounter = 0;
function makeFinding(overrides: Partial<SuspiciousFinding> = {}): SuspiciousFinding {
  idCounter += 1;
  return {
    id: `f-${idCounter}`,
    eventId: `evt-${idCounter}`,
    title: `Finding ${idCounter}`,
    description: "",
    severity: "warning",
    ...overrides,
  };
}

describe("computeRiskScore", () => {
  it("returns 0/low for an empty finding set", () => {
    expect(computeRiskScore([])).toEqual({ score: 0, level: "low" });
  });

  it("falls back to the flat severity cap when a finding has no riskScore (pre-Phase-5.13 caller)", () => {
    const result = computeRiskScore([makeFinding({ severity: "critical" })]);
    expect(result.score).toBe(22); // SEVERITY_CONTRIBUTION_CAP.critical, unscaled
  });

  it("scales a finding's contribution by its own confidence, not a flat weight", () => {
    const result = computeRiskScore([makeFinding({ severity: "warning", riskScore: 100 })]);
    expect(result.score).toBe(9); // cap 9 x (100/100)
  });

  it("scales down proportionally for a low-confidence finding", () => {
    const result = computeRiskScore([makeFinding({ severity: "informational", riskScore: 50 })]);
    expect(result.score).toBe(1); // cap 2 x 0.5 = 1.0
  });

  describe("category thresholds (80/60/40/0)", () => {
    it("reaches 'critical' at a total >= 80", () => {
      const findings = [1, 2, 3, 4].map((n) =>
        makeFinding({ title: `Distinct ${n}`, severity: "critical", riskScore: 100 }),
      );
      const result = computeRiskScore(findings); // 4 x 22 = 88
      expect(result.score).toBe(88);
      expect(result.level).toBe("critical");
    });

    it("reaches 'high' for a total in [60, 80)", () => {
      const findings = [1, 2, 3].map((n) =>
        makeFinding({ title: `Distinct ${n}`, severity: "critical", riskScore: 100 }),
      );
      const result = computeRiskScore(findings); // 3 x 22 = 66
      expect(result.score).toBe(66);
      expect(result.level).toBe("high");
    });

    it("reaches 'medium' for a total in [40, 60)", () => {
      const findings = [1, 2].map((n) =>
        makeFinding({ title: `Distinct ${n}`, severity: "critical", riskScore: 100 }),
      );
      const result = computeRiskScore(findings); // 2 x 22 = 44
      expect(result.score).toBe(44);
      expect(result.level).toBe("medium");
    });

    it("stays 'low' below 40", () => {
      const result = computeRiskScore([makeFinding({ severity: "critical", riskScore: 100 })]); // 22
      expect(result.score).toBe(22);
      expect(result.level).toBe("low");
    });
  });

  it("clamps the total at 100 even when raw contributions exceed it", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ title: `Distinct ${i}`, severity: "critical", riskScore: 100 }),
    ); // 10 x 22 = 220, uncapped
    const result = computeRiskScore(findings);
    expect(result.score).toBe(100);
    expect(result.level).toBe("critical");
  });

  it("deduplicates a large cluster of identical low-confidence findings via the log2 curve, instead of summing them linearly", () => {
    const findings = Array.from({ length: 200 }, () =>
      makeFinding({
        title: "Repeated Finding",
        severity: "informational",
        confidenceLevel: "low",
        riskScore: 10,
      }),
    );
    const result = computeRiskScore(findings);
    // average contribution 0.2 x (1 + log2(200) ~= 8.644) ~= 1.729 -> rounds to 2.
    expect(result.score).toBe(2);
    expect(result.level).toBe("low");
  });

  it("does NOT dedupe distinct findings even at the same volume — confirms the log2 curve only applies within a group", () => {
    const findings = Array.from({ length: 200 }, (_, i) =>
      makeFinding({ title: `Unique Finding ${i}`, severity: "informational", riskScore: 10 }),
    );
    const result = computeRiskScore(findings); // 200 x 0.2 = 40, no dedup grouping applies (all distinct titles)
    expect(result.score).toBe(40);
    expect(result.level).toBe("medium");
  });

  it("averages contributions within a dedup group before applying the log2 scale", () => {
    const findings = [
      makeFinding({
        title: "Same Rule",
        severity: "warning",
        confidenceLevel: "medium",
        riskScore: 50,
      }),
      makeFinding({
        title: "Same Rule",
        severity: "warning",
        confidenceLevel: "medium",
        riskScore: 70,
      }),
    ];
    const result = computeRiskScore(findings);
    // contributions: 9*0.5=4.5, 9*0.7=6.3 -> average 5.4 x (1+log2(2)=2) = 10.8 -> rounds to 11.
    expect(result.score).toBe(11);
  });

  it("groups by title + confidenceLevel (falling back to severity) — same title, different severity, does not merge", () => {
    const findings = [
      makeFinding({ title: "Ambiguous", severity: "critical", riskScore: 100 }),
      makeFinding({ title: "Ambiguous", severity: "warning", riskScore: 100 }),
    ];
    const result = computeRiskScore(findings);
    // Different dedup keys ("Ambiguous:critical" vs "Ambiguous:warning") -> two separate groups of size 1.
    expect(result.score).toBe(22 + 9);
  });
});
