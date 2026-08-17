import { describe, expect, it } from "vitest";
import { atMinute, findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "brute-force";
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

describe("bruteForceRule", () => {
  it("fires when 5 failed logons for the same account/host occur within 15 minutes", () => {
    const events = [0, 2, 4, 6, 8].map(failedLogon);
    const findings = findingsFor(RULE_ID, events);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1110");
  });

  it("does not fire with only 4 failed logons, even within the window", () => {
    const events = [0, 2, 4, 6].map(failedLogon);
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });

  it("does not fire when 5 failed logons are spread out so the sliding 15-minute window never holds more than 4 at once", () => {
    // 0, 4, 8, 12, 16 minutes: at the 16-minute event, the window (>= 15 min
    // back) has already dropped the 0-minute event, leaving only 4 in-window.
    const events = [0, 4, 8, 12, 16].map(failedLogon);
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });

  it("does not correlate failed logons across different accounts/hosts", () => {
    const events = [
      failedLogon(0),
      failedLogon(1),
      makeEvent({ eventId: 4625, user: "DOMAIN\\other", computer: HOST, timestamp: atMinute(2) }),
      makeEvent({ eventId: 4625, user: USER, computer: "OTHERHOST", timestamp: atMinute(3) }),
      failedLogon(4),
    ];
    // Only 3 events actually share the same user@host key — below threshold.
    expect(findingsFor(RULE_ID, events)).toHaveLength(0);
  });
});
