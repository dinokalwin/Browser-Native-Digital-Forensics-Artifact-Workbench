import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "new-user-account";

describe("newUserAccountRule", () => {
  it("fires on Event ID 4720 (user account created)", () => {
    const event = makeEvent({ eventId: 4720 });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].mitreTechnique).toBe("T1136.001");
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 4722 }); // account enabled, not created
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
