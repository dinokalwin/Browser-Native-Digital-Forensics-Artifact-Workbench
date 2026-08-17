/**
 * Phase 5 Item 2 — Configurable Rule Set. Tests `runDetectionEngine`'s new
 * optional `enabledRuleIds` parameter directly (node environment — no
 * localStorage/jsdom involved here; that's covered by `ruleConfig.test.ts`
 * and `ruleConfigStore.test.ts`). Reuses this project's existing
 * `makeEvent`/`atMinute` fixtures rather than hand-building a new fixture
 * set, per the project's "reuse existing test utilities" convention (same
 * events `bruteForce.test.ts`/`usbDevice.test.ts`/`contextScoring.test.ts`
 * already use to make specific rules fire deterministically).
 */
import { describe, expect, it } from "vitest";
import { runDetectionEngine } from "../engine";
import { getAllRules } from "../registry";
import { atMinute, makeEvent } from "../rules/__tests__/testHelpers";

const BRUTE_FORCE = "brute-force";
const USB_DEVICE = "usb-device";
const USER = "DOMAIN\\jsmith";
const HOST = "WORKSTATION1";

/** 5 failed logons within the sliding window — reliably fires `brute-force`
 * (same fixture shape as `bruteForce.test.ts`). */
function bruteForceEvents() {
  return [0, 2, 4, 6, 8].map((offset) =>
    makeEvent({ eventId: 4625, user: USER, computer: HOST, timestamp: atMinute(offset) }),
  );
}

/** Reliably fires `usb-device` (same fixture shape as `usbDevice.test.ts`). */
function usbDeviceEvent() {
  return makeEvent({ eventId: 20001 });
}

function buildServiceMessage(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([name, value]) => `${name}: ${value}`)
    .join(" | ");
}

/** Fires `service-installation` with a kernel-mode-driver evidence signal —
 * same fixture shape as `contextScoring.test.ts`'s own regression test. */
function kernelModeDriverEvent() {
  return makeEvent({
    eventId: 7045,
    computer: HOST,
    message: buildServiceMessage({
      ServiceName: "wdfilter",
      ImagePath: "C:\\Windows\\System32\\drivers\\wd\\WdFilter.sys",
      ServiceType: "Kernel Mode Driver",
    }),
  });
}

describe("runDetectionEngine — enabledRuleIds filtering (Phase 5 Item 2)", () => {
  it("default (no enabledRuleIds argument): every registered rule runs, unchanged from pre-Phase-5.2 behavior", () => {
    const findings = runDetectionEngine(bruteForceEvents());
    expect(findings.some((f) => f.ruleId === BRUTE_FORCE)).toBe(true);
  });

  it("excluding a rule's id from enabledRuleIds stops it from producing findings", () => {
    const allOtherRuleIds = new Set(
      getAllRules().map((r) => r.id).filter((id) => id !== BRUTE_FORCE),
    );
    const findings = runDetectionEngine(bruteForceEvents(), allOtherRuleIds);
    expect(findings.some((f) => f.ruleId === BRUTE_FORCE)).toBe(false);
  });

  it("re-including a previously-excluded rule's id restores its findings", () => {
    const withoutBruteForce = new Set(
      getAllRules().map((r) => r.id).filter((id) => id !== BRUTE_FORCE),
    );
    const withBruteForce = new Set(getAllRules().map((r) => r.id));

    const events = bruteForceEvents();
    expect(runDetectionEngine(events, withoutBruteForce).some((f) => f.ruleId === BRUTE_FORCE)).toBe(
      false,
    );
    expect(runDetectionEngine(events, withBruteForce).some((f) => f.ruleId === BRUTE_FORCE)).toBe(
      true,
    );
  });

  it("disabling one rule does not affect an unrelated rule's findings", () => {
    const events = [...bruteForceEvents(), usbDeviceEvent()];
    const withoutBruteForce = new Set(
      getAllRules().map((r) => r.id).filter((id) => id !== BRUTE_FORCE),
    );
    const findings = runDetectionEngine(events, withoutBruteForce);
    expect(findings.some((f) => f.ruleId === BRUTE_FORCE)).toBe(false);
    expect(findings.some((f) => f.ruleId === USB_DEVICE)).toBe(true);
  });

  it("an enabled rule's finding content is identical whether reached via the default path or an explicit full-inclusion set", () => {
    // `id` is intentionally excluded from the comparison: `makeFindingId`
    // mints a fresh unique id on every separate `runDetectionEngine` call
    // (by design — two independent engine runs over the same events are
    // not required to produce byte-identical ids), so this test compares
    // everything that *should* be unaffected by `enabledRuleIds` filtering:
    // severity, confidence, scoring, evidence signals, description, etc.
    const events = bruteForceEvents();
    const viaDefault = runDetectionEngine(events).map(({ id: _id, ...rest }) => rest);
    const viaExplicitFullSet = runDetectionEngine(
      events,
      new Set(getAllRules().map((r) => r.id)),
    ).map(({ id: _id, ...rest }) => rest);
    expect(viaExplicitFullSet).toEqual(viaDefault);
  });

  it("an unknown/invalid rule id in enabledRuleIds is silently ignored — no crash, and it doesn't enable anything", () => {
    const bogusOnly = new Set(["this-rule-id-does-not-exist"]);
    expect(() => runDetectionEngine(bruteForceEvents(), bogusOnly)).not.toThrow();
    expect(runDetectionEngine(bruteForceEvents(), bogusOnly)).toHaveLength(0);
  });

  it("an unknown rule id alongside a real one doesn't prevent the real rule from running", () => {
    const mixed = new Set(["this-rule-id-does-not-exist", BRUTE_FORCE]);
    const findings = runDetectionEngine(bruteForceEvents(), mixed);
    expect(findings.some((f) => f.ruleId === BRUTE_FORCE)).toBe(true);
  });

  it("an empty enabledRuleIds set disables every rule (zero findings), without throwing", () => {
    const events = [...bruteForceEvents(), usbDeviceEvent()];
    expect(() => runDetectionEngine(events, new Set())).not.toThrow();
    expect(runDetectionEngine(events, new Set())).toHaveLength(0);
  });

  it("regression: context/confidence scoring is intact through the default (unfiltered) call path", () => {
    const [finding] = runDetectionEngine(bruteForceEvents()).filter(
      (f) => f.ruleId === BRUTE_FORCE,
    );
    expect(finding.severity).toBe("critical");
    expect(finding.mitreTechnique).toBe("T1110");
    expect(typeof finding.confidence).toBe("number");
    expect(finding.confidenceLevel).toBeDefined();
  });

  it("regression: kernel-mode-driver evidence signal and correlation/scoring pipeline are intact through the default call path", () => {
    const [finding] = runDetectionEngine([kernelModeDriverEvent()]).filter(
      (f) => f.ruleId === "service-installation",
    );
    const signal = finding.evidenceSignals?.find((s) => s.type === "kernel-mode-driver");
    expect(signal).toBeTruthy();
    expect(signal?.weight).toBe(20);
    expect(signal?.severity).toBe("negative");
  });

  it("regression: the kernel-mode-driver signal still appears when the rule is reached via an explicit enabledRuleIds set (not just the default path)", () => {
    const explicit = new Set(getAllRules().map((r) => r.id));
    const [finding] = runDetectionEngine([kernelModeDriverEvent()], explicit).filter(
      (f) => f.ruleId === "service-installation",
    );
    expect(finding.evidenceSignals?.some((s) => s.type === "kernel-mode-driver")).toBe(true);
  });

  it("an unrelated rule's own detection logic (severity, MITRE technique, description) is unaffected by which other rules are enabled", () => {
    // Deliberately does NOT assert full deep-equality: `correlatedFindingCount`
    // (part of Phase 5.13.1's cross-finding correlation scoring) is *expected*
    // to differ here, because disabling the brute-force rule means there is
    // one fewer co-occurring finding for the usb-device finding to correlate
    // against — that is existing, unmodified correlation behavior reacting
    // correctly to fewer active rules, not something this phase changed.
    const events = [...bruteForceEvents(), usbDeviceEvent()];
    const [usbOnly] = runDetectionEngine(events, new Set([USB_DEVICE])).filter(
      (f) => f.ruleId === USB_DEVICE,
    );
    const [usbFromDefault] = runDetectionEngine(events).filter((f) => f.ruleId === USB_DEVICE);
    expect(usbOnly.severity).toBe(usbFromDefault.severity);
    expect(usbOnly.mitreTechnique).toBe(usbFromDefault.mitreTechnique);
    expect(usbOnly.description).toBe(usbFromDefault.description);
    expect(usbOnly.recommendation).toBe(usbFromDefault.recommendation);
  });
});
