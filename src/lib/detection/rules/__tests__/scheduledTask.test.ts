import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "scheduled-task";

describe("scheduledTaskRule", () => {
  it("fires on Event ID 4698 (scheduled task created)", () => {
    const event = makeEvent({ eventId: 4698, message: "A scheduled task was created." });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].mitreTechnique).toBe("T1053.005");
  });

  it("fires on Event ID 106 (Task Scheduler operational registration)", () => {
    const event = makeEvent({ eventId: 106 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 4699 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
