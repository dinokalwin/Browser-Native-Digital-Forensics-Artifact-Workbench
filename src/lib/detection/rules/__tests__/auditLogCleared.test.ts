import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "audit-log-cleared";

describe("auditLogClearedRule", () => {
  it("fires on Event ID 1102 (Security log cleared)", () => {
    const event = makeEvent({ eventId: 1102, computer: "DC01", user: "DOMAIN\\admin" });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].eventId).toBe(event.id);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1070.001");
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 4624 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });

  it("produces one finding per occurrence", () => {
    const events = [makeEvent({ eventId: 1102 }), makeEvent({ eventId: 1102 })];
    expect(findingsFor(RULE_ID, events)).toHaveLength(2);
  });
});
