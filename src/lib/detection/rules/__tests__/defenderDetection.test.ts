import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "defender-detection";

describe("defenderDetectionRule", () => {
  it("fires on Event ID 1116 (Defender malware detection)", () => {
    const event = makeEvent({ eventId: 1116, message: "Trojan:Win32/Fakename detected." });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1204");
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 1117 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
