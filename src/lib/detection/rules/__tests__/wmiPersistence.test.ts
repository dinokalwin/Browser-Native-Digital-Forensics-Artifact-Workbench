import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "wmi-persistence";

describe("wmiPersistenceRule", () => {
  it("fires on Event ID 5861 (WMI-Activity operational)", () => {
    const event = makeEvent({ eventId: 5861, provider: "Microsoft-Windows-WMI-Activity" });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1546.003");
  });

  it("fires on a WMI-Activity provider event whose message references EventConsumer/EventFilter", () => {
    const event = makeEvent({
      eventId: 5859,
      provider: "Microsoft-Windows-WMI-Activity",
      message: "CommandLineEventConsumer registered a FilterToConsumerBinding.",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on an unrelated provider even if the message mentions WMI terms", () => {
    const event = makeEvent({
      eventId: 5859,
      provider: "Microsoft-Windows-Security-Auditing",
      message: "EventConsumer discussed in documentation.",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });

  it("does not fire on a WMI-Activity event with no persistence-related terms", () => {
    const event = makeEvent({
      eventId: 5857,
      provider: "Microsoft-Windows-WMI-Activity",
      message: "A provider started successfully.",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
