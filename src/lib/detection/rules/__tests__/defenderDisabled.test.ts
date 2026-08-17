import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "defender-disabled";

describe("defenderDisabledRule", () => {
  it("fires on Event ID 5001 (real-time protection disabled)", () => {
    const event = makeEvent({ eventId: 5001 });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1562.001");
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 5007 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
