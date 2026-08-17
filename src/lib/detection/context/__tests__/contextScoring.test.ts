/**
 * Phase 2 (extension) — Automated Test Foundation. `contextScoring.ts` is
 * the single integration point every raw rule finding passes through
 * (`enrichFindings`, called once by `engine.ts#runDetectionEngine`) and had
 * no dedicated test coverage before this file, despite being the module
 * the Phase 5.13.1 correlation fix and the kernel-mode-driver signal both
 * live in.
 *
 * Two testing strategies, deliberately kept separate:
 *  - Pure-function tests call `isStronglyLegitimateService`,
 *    `shouldApplyCorrelationBonus`, `confidenceLevelFor`,
 *    `calculateFindingConfidence`, `computeThreatScoreBreakdown`,
 *    `scoreCategoryFor`, and `getFindingExplanation` directly with
 *    hand-built inputs — precise boundary coverage, no engine involved.
 *  - End-to-end tests run real events through the actual production
 *    pipeline (`runDetectionEngine`, imported directly — same function
 *    `evidenceStore.ts` calls) and inspect the resulting
 *    `DetectionFinding.evidenceSignals`/`context`, so the enrichment
 *    wiring itself (not just the pure helpers) is exercised. Reuses this
 *    project's existing `makeEvent`/`atMinute` test fixtures from the
 *    detection-rules suite per this phase's "reuse existing test
 *    utilities" requirement.
 */
import { describe, expect, it } from "vitest";
import { atMinute, makeEvent } from "../../rules/__tests__/testHelpers";
import { runDetectionEngine } from "../../engine";
import type { DetectionFinding } from "../../types";
import {
  calculateFindingConfidence,
  computeThreatScoreBreakdown,
  confidenceLevelFor,
  getFindingExplanation,
  isStronglyLegitimateService,
  scoreCategoryFor,
  shouldApplyCorrelationBonus,
  type EvidenceSignal,
} from "../contextScoring";
import type { ServiceContext } from "../serviceContext";

function buildServiceMessage(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([name, value]) => `${name}: ${value}`)
    .join(" | ");
}

function findingsWithRuleId(
  events: ReturnType<typeof makeEvent>[],
  ruleId: string,
): DetectionFinding[] {
  return runDetectionEngine(events).filter((f) => f.ruleId === ruleId);
}

function findSignal(finding: DetectionFinding, type: string): EvidenceSignal | undefined {
  return finding.evidenceSignals?.find((s) => s.type === type);
}

// ---------------------------------------------------------------------------
// Pure-function tests
// ---------------------------------------------------------------------------

describe("confidenceLevelFor", () => {
  it("buckets at the documented 75/50/25/0 thresholds", () => {
    expect(confidenceLevelFor(0)).toBe("low");
    expect(confidenceLevelFor(24)).toBe("low");
    expect(confidenceLevelFor(25)).toBe("medium");
    expect(confidenceLevelFor(49)).toBe("medium");
    expect(confidenceLevelFor(50)).toBe("high");
    expect(confidenceLevelFor(74)).toBe("high");
    expect(confidenceLevelFor(75)).toBe("critical");
    expect(confidenceLevelFor(100)).toBe("critical");
  });

  it("clamps out-of-range scores instead of misclassifying", () => {
    expect(confidenceLevelFor(-10)).toBe("low");
    expect(confidenceLevelFor(150)).toBe("critical");
  });
});

describe("calculateFindingConfidence", () => {
  it("sums signal weights onto the base risk and clamps to 0-100", () => {
    const signals: EvidenceSignal[] = [
      { type: "a", label: "a", description: "", weight: -15, severity: "positive" },
      { type: "b", label: "b", description: "", weight: 20, severity: "negative" },
    ];
    expect(calculateFindingConfidence(35, signals)).toBe(40); // 35 - 15 + 20
  });

  it("clamps above 100 and below 0", () => {
    expect(
      calculateFindingConfidence(90, [
        { type: "x", label: "x", description: "", weight: 50, severity: "negative" },
      ]),
    ).toBe(100);
    expect(
      calculateFindingConfidence(10, [
        { type: "x", label: "x", description: "", weight: -50, severity: "positive" },
      ]),
    ).toBe(0);
  });
});

function makeServiceContext(overrides: Partial<ServiceContext> = {}): ServiceContext {
  return {
    serviceName: "OrdinaryService",
    displayName: "Ordinary Service",
    imagePath: "C:\\Program Files\\Vendor\\svc.exe",
    account: "LocalSystem",
    accountClass: "system",
    startType: "auto start",
    serviceType: "user mode service",
    pathClassification: {
      classification: "trusted-application",
      matchedSegment: "\\program files\\",
    },
    vendorMatch: { matched: true, vendor: "vendor", source: "service-name" },
    unusualName: false,
    ...overrides,
  };
}

describe("isStronglyLegitimateService", () => {
  it("is true when vendor-matched, trusted-path, and ordinarily named", () => {
    expect(isStronglyLegitimateService(makeServiceContext())).toBe(true);
  });

  it("is true for a trusted-system path too, not just trusted-application", () => {
    expect(
      isStronglyLegitimateService(
        makeServiceContext({
          pathClassification: { classification: "trusted-system", matchedSegment: "x" },
        }),
      ),
    ).toBe(true);
  });

  it("is false when the vendor didn't match", () => {
    expect(
      isStronglyLegitimateService(
        makeServiceContext({ vendorMatch: { matched: false, vendor: null, source: null } }),
      ),
    ).toBe(false);
  });

  it("is false when the path isn't trusted", () => {
    expect(
      isStronglyLegitimateService(
        makeServiceContext({
          pathClassification: { classification: "user-writable", matchedSegment: "x" },
        }),
      ),
    ).toBe(false);
  });

  it("is false when the service name looks machine-generated", () => {
    expect(isStronglyLegitimateService(makeServiceContext({ unusualName: true }))).toBe(false);
  });
});

function makeFinding(overrides: Partial<DetectionFinding> = {}): DetectionFinding {
  return {
    id: "f-1",
    ruleId: "service-installation",
    ruleName: "Service Installation",
    eventId: "evt-1",
    title: "t",
    description: "",
    severity: "warning",
    recommendation: "",
    ...overrides,
  };
}

describe("shouldApplyCorrelationBonus", () => {
  it("never applies below the 2-neighbor threshold", () => {
    const decision = shouldApplyCorrelationBonus(
      makeFinding(),
      [makeFinding({ id: "f-2" })],
      null,
      null,
      null,
    );
    expect(decision.apply).toBe(false);
    expect(decision.count).toBe(1);
  });

  it("applies unconditionally for a non-service, non-scheduled-task rule once the threshold is met (unchanged original behavior)", () => {
    const finding = makeFinding({ ruleId: "usb-device" });
    const neighbors = [makeFinding({ id: "f-2" }), makeFinding({ id: "f-3" })];
    const decision = shouldApplyCorrelationBonus(finding, neighbors, null, null, null);
    expect(decision.apply).toBe(true);
  });

  it("withholds the bonus for a strongly-legitimate service-installation finding with no suspicious neighbor", () => {
    const finding = makeFinding({ ruleId: "service-installation" });
    const neighbors = [
      makeFinding({ id: "f-2", ruleId: "service-installation" }),
      makeFinding({ id: "f-3", ruleId: "service-installation" }),
    ];
    const decision = shouldApplyCorrelationBonus(
      finding,
      neighbors,
      makeServiceContext(),
      "trusted-application",
      {
        matched: true,
        vendor: "vendor",
        source: "service-name",
      },
    );
    expect(decision.apply).toBe(false);
  });

  it("applies the bonus for a strongly-legitimate service-installation finding when a genuinely suspicious rule fired nearby", () => {
    const finding = makeFinding({ ruleId: "service-installation" });
    const neighbors = [
      makeFinding({ id: "f-2", ruleId: "service-installation" }),
      makeFinding({ id: "f-3", ruleId: "encoded-powershell", ruleName: "Encoded PowerShell" }),
    ];
    const decision = shouldApplyCorrelationBonus(
      finding,
      neighbors,
      makeServiceContext(),
      "trusted-application",
      {
        matched: true,
        vendor: "vendor",
        source: "service-name",
      },
    );
    expect(decision.apply).toBe(true);
    expect(decision.reason).toContain("Encoded PowerShell");
  });

  it("applies the bonus for a service-installation finding that is NOT strongly legitimate, even with no suspicious neighbor", () => {
    const finding = makeFinding({ ruleId: "service-installation" });
    const neighbors = [
      makeFinding({ id: "f-2", ruleId: "service-installation" }),
      makeFinding({ id: "f-3", ruleId: "service-installation" }),
    ];
    const decision = shouldApplyCorrelationBonus(
      finding,
      neighbors,
      makeServiceContext({ unusualName: true }), // fails the "strongly legitimate" conjunction
      "trusted-application",
      { matched: true, vendor: "vendor", source: "service-name" },
    );
    expect(decision.apply).toBe(true);
  });

  it("withholds the bonus for a scheduled-task finding referencing a known vendor from a trusted path", () => {
    const finding = makeFinding({ ruleId: "scheduled-task", ruleName: "Scheduled Task" });
    const neighbors = [makeFinding({ id: "f-2" }), makeFinding({ id: "f-3" })];
    const decision = shouldApplyCorrelationBonus(finding, neighbors, null, "trusted-application", {
      matched: true,
      vendor: "microsoft",
      source: "other",
    });
    expect(decision.apply).toBe(false);
  });

  it("applies the bonus for a scheduled-task finding whose path/vendor is NOT trusted", () => {
    const finding = makeFinding({ ruleId: "scheduled-task", ruleName: "Scheduled Task" });
    const neighbors = [makeFinding({ id: "f-2" }), makeFinding({ id: "f-3" })];
    const decision = shouldApplyCorrelationBonus(finding, neighbors, null, "temporary", {
      matched: false,
      vendor: null,
      source: null,
    });
    expect(decision.apply).toBe(true);
  });
});

describe("scoreCategoryFor", () => {
  it("buckets at the documented 80/60/40/20/0 thresholds", () => {
    expect(scoreCategoryFor(0)).toBe("Minimal");
    expect(scoreCategoryFor(19)).toBe("Minimal");
    expect(scoreCategoryFor(20)).toBe("Low");
    expect(scoreCategoryFor(39)).toBe("Low");
    expect(scoreCategoryFor(40)).toBe("Moderate");
    expect(scoreCategoryFor(59)).toBe("Moderate");
    expect(scoreCategoryFor(60)).toBe("High");
    expect(scoreCategoryFor(79)).toBe("High");
    expect(scoreCategoryFor(80)).toBe("Critical");
    expect(scoreCategoryFor(100)).toBe("Critical");
  });
});

describe("computeThreatScoreBreakdown", () => {
  it("tallies findings by confidenceLevel and surfaces top signal labels", () => {
    const findings: DetectionFinding[] = [
      makeFinding({
        id: "1",
        confidenceLevel: "critical",
        evidenceSignals: [
          {
            type: "a",
            label: "Encoded command",
            description: "",
            weight: 35,
            severity: "negative",
          },
        ],
      }),
      makeFinding({
        id: "2",
        confidenceLevel: "high",
        evidenceSignals: [
          {
            type: "a",
            label: "Encoded command",
            description: "",
            weight: 35,
            severity: "negative",
          },
        ],
      }),
      makeFinding({ id: "3", confidenceLevel: "medium" }),
      makeFinding({
        id: "4",
        confidenceLevel: "low",
        evidenceSignals: [
          { type: "b", label: "Known vendor", description: "", weight: -10, severity: "positive" },
        ],
      }),
    ];
    const breakdown = computeThreatScoreBreakdown(findings, 42);
    expect(breakdown.overallScore).toBe(42);
    expect(breakdown.category).toBe("Moderate");
    expect(breakdown.criticalCount).toBe(1);
    expect(breakdown.highConfidenceCount).toBe(1);
    expect(breakdown.mediumConfidenceCount).toBe(1);
    expect(breakdown.lowConfidenceCount).toBe(1);
    expect(breakdown.topRiskFactors[0]).toEqual({ label: "Encoded command", occurrences: 2 });
    expect(breakdown.topLegitimateIndicators[0]).toEqual({ label: "Known vendor", occurrences: 1 });
  });

  it("returns an all-zero breakdown for an empty finding set", () => {
    const breakdown = computeThreatScoreBreakdown([], 0);
    expect(breakdown.criticalCount).toBe(0);
    expect(breakdown.topRiskFactors).toEqual([]);
    expect(breakdown.topLegitimateIndicators).toEqual([]);
  });

  it("treats a finding with no confidenceLevel as 'low'", () => {
    const breakdown = computeThreatScoreBreakdown([makeFinding()], 0);
    expect(breakdown.lowConfidenceCount).toBe(1);
  });
});

describe("getFindingExplanation", () => {
  it("splits signals into positive/negative, sorted by magnitude", () => {
    const finding = makeFinding({
      confidence: 60,
      confidenceLevel: "high",
      evidenceSignals: [
        { type: "a", label: "A", description: "", weight: 20, severity: "negative" },
        { type: "b", label: "B", description: "", weight: 35, severity: "negative" },
        { type: "c", label: "C", description: "", weight: -15, severity: "positive" },
      ],
    });
    const explanation = getFindingExplanation(finding);
    expect(explanation.negativeSignals.map((s) => s.type)).toEqual(["b", "a"]); // largest weight first
    expect(explanation.positiveSignals.map((s) => s.type)).toEqual(["c"]);
    expect(explanation.confidence).toBe(60);
  });

  it("never throws for a finding with no evidenceSignals at all", () => {
    const explanation = getFindingExplanation(makeFinding());
    expect(explanation.positiveSignals).toEqual([]);
    expect(explanation.negativeSignals).toEqual([]);
    expect(explanation.summary).toContain("No additional context signals");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: evidenceSignals generation via the real detection pipeline
// ---------------------------------------------------------------------------

const HOST = "WORKSTATION1";

describe("enrichFindings (via runDetectionEngine) — evidenceSignals generation", () => {
  it("pushes a trusted-system-path and expected-vendor signal for a legitimate service in System32", () => {
    const event = makeEvent({
      eventId: 7045,
      computer: HOST,
      message: buildServiceMessage({
        ServiceName: "MicrosoftUpdateSvc",
        ImagePath: "C:\\Windows\\System32\\muupdate.exe",
        AccountName: "LocalSystem",
      }),
    });
    const [finding] = findingsWithRuleId([event], "service-installation");
    expect(findSignal(finding, "trusted-system-path")).toBeTruthy();
    expect(findSignal(finding, "expected-vendor")).toBeTruthy();
    expect(findSignal(finding, "expected-service-naming")).toBeTruthy();
  });

  it("pushes an unusual-service-name signal for a machine-generated service name", () => {
    const event = makeEvent({
      eventId: 7045,
      computer: HOST,
      message: buildServiceMessage({
        ServiceName: "a1b2c3d4e5f6a7b8",
        ImagePath: "C:\\Users\\jsmith\\AppData\\Local\\Temp\\svc.exe",
      }),
    });
    const [finding] = findingsWithRuleId([event], "service-installation");
    expect(findSignal(finding, "unusual-service-name")).toBeTruthy();
    expect(findSignal(finding, "temporary-path")).toBeTruthy();
  });

  it("regression: pushes a kernel-mode-driver signal when ServiceType indicates a kernel-mode driver", () => {
    const event = makeEvent({
      eventId: 7045,
      computer: HOST,
      message: buildServiceMessage({
        ServiceName: "wdfilter",
        ImagePath: "C:\\Windows\\System32\\drivers\\wd\\WdFilter.sys",
        ServiceType: "Kernel Mode Driver",
      }),
    });
    const [finding] = findingsWithRuleId([event], "service-installation");
    const signal = findSignal(finding, "kernel-mode-driver");
    expect(signal).toBeTruthy();
    expect(signal?.weight).toBe(20);
    expect(signal?.severity).toBe("negative");
  });

  it("does not push a kernel-mode-driver signal for an ordinary user-mode service", () => {
    const event = makeEvent({
      eventId: 7045,
      computer: HOST,
      message: buildServiceMessage({
        ServiceName: "OrdinarySvc",
        ServiceType: "user mode service",
      }),
    });
    const [finding] = findingsWithRuleId([event], "service-installation");
    expect(findSignal(finding, "kernel-mode-driver")).toBeUndefined();
  });

  it("pushes a system-from-untrusted-path signal when a SYSTEM service runs from Temp", () => {
    const event = makeEvent({
      eventId: 7045,
      computer: HOST,
      message: buildServiceMessage({
        ServiceName: "EvilSvc",
        ImagePath: "C:\\Windows\\Temp\\evil.exe",
        AccountName: "LocalSystem",
      }),
    });
    const [finding] = findingsWithRuleId([event], "service-installation");
    const signal = findSignal(finding, "system-from-untrusted-path");
    expect(signal).toBeTruthy();
    expect(signal?.weight).toBe(35);
  });

  it("does not push a system-from-untrusted-path signal when SYSTEM runs from a trusted path", () => {
    const event = makeEvent({
      eventId: 7045,
      computer: HOST,
      message: buildServiceMessage({
        ServiceName: "GoodSvc",
        ImagePath: "C:\\Windows\\System32\\good.exe",
        AccountName: "LocalSystem",
      }),
    });
    const [finding] = findingsWithRuleId([event], "service-installation");
    expect(findSignal(finding, "system-from-untrusted-path")).toBeUndefined();
  });

  it("pushes an encoded-command signal for obfuscated PowerShell text", () => {
    const event = makeEvent({
      eventId: 4104,
      computer: HOST,
      message: "powershell.exe -enc SQBFAFgA",
    });
    const [finding] = findingsWithRuleId([event], "encoded-powershell");
    expect(findSignal(finding, "encoded-command")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// End-to-end: Phase 5.13.1 correlation-suppression regression tests
// ---------------------------------------------------------------------------

describe("correlation suppression regression (Phase 5.13.1)", () => {
  function legitServiceEvent(name: string, imagePath: string, minute: number) {
    return makeEvent({
      eventId: 7045,
      computer: HOST,
      timestamp: atMinute(minute),
      message: buildServiceMessage({
        ServiceName: name,
        ImagePath: imagePath,
        AccountName: "LocalSystem",
      }),
    });
  }

  it("withholds the correlated-activity bonus across a burst of mutually-legitimate service installs (the original false-positive-amplification bug)", () => {
    const events = [
      legitServiceEvent(
        "ProtonVPNService",
        "C:\\Program Files\\Proton\\ProtonVPN\\ProtonVPNService.exe",
        0,
      ),
      legitServiceEvent("WireGuardTunnel", "C:\\Program Files\\WireGuard\\wireguard.exe", 2),
      legitServiceEvent("WintunAdapter", "C:\\Program Files\\WireGuard\\wintun.exe", 4),
    ];
    const findings = findingsWithRuleId(events, "service-installation");
    expect(findings).toHaveLength(3);
    for (const finding of findings) {
      expect(findSignal(finding, "correlated-activity")).toBeUndefined();
    }
  });

  it("still applies the correlated-activity bonus when a genuinely suspicious rule fires near otherwise-legitimate service installs", () => {
    const events = [
      legitServiceEvent(
        "ProtonVPNService",
        "C:\\Program Files\\Proton\\ProtonVPN\\ProtonVPNService.exe",
        0,
      ),
      legitServiceEvent("WireGuardTunnel", "C:\\Program Files\\WireGuard\\wireguard.exe", 2),
      makeEvent({
        eventId: 4104,
        computer: HOST,
        timestamp: atMinute(4),
        message: "powershell.exe -enc SQBFAFgA",
      }),
    ];
    const serviceFindings = findingsWithRuleId(events, "service-installation");
    expect(serviceFindings).toHaveLength(2);
    for (const finding of serviceFindings) {
      expect(findSignal(finding, "correlated-activity")).toBeTruthy();
    }
  });

  it("still applies the correlated-activity bonus for a burst of non-legitimate (unusual-named) service installs", () => {
    const events = [
      legitServiceEvent("a1b2c3d4e5f6a7b8", "C:\\Temp\\a.exe", 0),
      legitServiceEvent("b2c3d4e5f6a7b8c9", "C:\\Temp\\b.exe", 2),
      legitServiceEvent("c3d4e5f6a7b8c9d0", "C:\\Temp\\c.exe", 4),
    ];
    const findings = findingsWithRuleId(events, "service-installation");
    expect(findings).toHaveLength(3);
    for (const finding of findings) {
      expect(findSignal(finding, "correlated-activity")).toBeTruthy();
    }
  });

  it("withholds the correlated-activity bonus for a scheduled task referencing a known vendor from a trusted path", () => {
    // For non-service findings, enrichOne classifies the path from
    // `extractExecutablePath(event.message)`, which only recognizes a
    // path at the very START of the message (quoted, to preserve the
    // space in "Program Files") — matching how `extractExecutablePath`
    // is actually implemented, not a hand-wavy approximation of it.
    const events = [0, 2, 4].map((minute) =>
      makeEvent({
        eventId: 4698,
        computer: HOST,
        timestamp: atMinute(minute),
        message:
          '"C:\\Program Files\\Microsoft\\Updater\\update.exe" was registered as a scheduled task.',
      }),
    );
    const findings = findingsWithRuleId(events, "scheduled-task");
    expect(findings).toHaveLength(3);
    for (const finding of findings) {
      expect(findSignal(finding, "correlated-activity")).toBeUndefined();
    }
  });

  it("still applies the correlated-activity bonus for scheduled tasks from an untrusted path", () => {
    const events = [0, 2, 4].map((minute) =>
      makeEvent({
        eventId: 4698,
        computer: HOST,
        timestamp: atMinute(minute),
        message:
          '"C:\\Users\\jsmith\\AppData\\Local\\Temp\\evil.exe" was registered as a scheduled task.',
      }),
    );
    const findings = findingsWithRuleId(events, "scheduled-task");
    expect(findings).toHaveLength(3);
    for (const finding of findings) {
      expect(findSignal(finding, "correlated-activity")).toBeTruthy();
    }
  });

  it("does not correlate findings across different hosts", () => {
    const events = [
      legitServiceEvent("SvcA", "C:\\Temp\\a.exe", 0),
      makeEvent({
        eventId: 7045,
        computer: "OTHERHOST",
        timestamp: atMinute(1),
        message: buildServiceMessage({ ServiceName: "SvcB", ImagePath: "C:\\Temp\\b.exe" }),
      }),
    ];
    const findings = findingsWithRuleId(events, "service-installation");
    for (const finding of findings) {
      expect(finding.context?.correlatedFindingCount).toBe(0);
    }
  });
});
