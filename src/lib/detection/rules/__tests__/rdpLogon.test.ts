import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "rdp-logon";

describe("rdpLogonRule", () => {
  it("fires on 4624 with Logon Type: 10 (RemoteInteractive)", () => {
    const event = makeEvent({
      eventId: 4624,
      message: "An account was successfully logged on. Logon Type: 10",
    });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("informational");
    expect(findings[0].mitreTechnique).toBe("T1021.001");
  });

  it("fires on 1149 (TerminalServices authentication succeeded)", () => {
    const event = makeEvent({ eventId: 1149 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on 4624 with a different logon type", () => {
    const event = makeEvent({
      eventId: 4624,
      message: "An account was successfully logged on. Logon Type: 2",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
