import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "new-administrator";

describe("newAdministratorRule", () => {
  it("fires on 4728 when the message names an admin-tier group", () => {
    const event = makeEvent({
      eventId: 4728,
      message: "A member was added to security-enabled global group Domain Admins.",
    });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1098");
  });

  it("fires on 4732/4756 too, for the same admin-group pattern", () => {
    const events = [
      makeEvent({ eventId: 4732, message: "Added to local group Administrators." }),
      makeEvent({ eventId: 4756, message: "Added to universal group Enterprise Admins." }),
    ];
    expect(findingsFor(RULE_ID, events)).toHaveLength(2);
  });

  it("does not fire on a non-admin group membership change", () => {
    const event = makeEvent({
      eventId: 4728,
      message: "A member was added to security-enabled group Marketing.",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 4738, message: "Domain Admins" });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
