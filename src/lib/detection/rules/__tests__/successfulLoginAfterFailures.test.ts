import { describe, expect, it } from "vitest";
import { atMinute, findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "successful-login-after-failures";
const USER = "DOMAIN\\jsmith";
const HOST = "WORKSTATION1";

function failedLogon(offsetMinutes: number) {
  return makeEvent({
    eventId: 4625,
    user: USER,
    computer: HOST,
    timestamp: atMinute(offsetMinutes),
  });
}
function successLogon(offsetMinutes: number) {
  return makeEvent({
    eventId: 4624,
    user: USER,
    computer: HOST,
    timestamp: atMinute(offsetMinutes),
  });
}

describe("successfulLoginAfterFailuresRule", () => {
  it("fires when 3+ failed logons are followed by a success within 30 minutes", () => {
    const events = [failedLogon(0), failedLogon(1), failedLogon(2), successLogon(10)];
    const findings = findingsFor(RULE_ID, events);
    expect(findings).toHaveLength(1);
    expect(findings[0].eventId).toBe(events[3].id);
    expect(findings[0].severity).toBe("critical");
  });

  it("does not fire with only failures and no eventual success", () => {
    const events = [failedLogon(0), failedLogon(1), failedLogon(2)];
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });

  it("does not fire when the success occurs more than 30 minutes after the failure cluster", () => {
    const events = [failedLogon(0), failedLogon(1), failedLogon(2), successLogon(45)];
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });

  it("does not fire with fewer than 3 failures before the success", () => {
    const events = [failedLogon(0), failedLogon(1), successLogon(5)];
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });

  it("does not correlate a success on a different account", () => {
    const events = [
      failedLogon(0),
      failedLogon(1),
      failedLogon(2),
      makeEvent({ eventId: 4624, user: "DOMAIN\\other", computer: HOST, timestamp: atMinute(5) }),
    ];
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });
});
