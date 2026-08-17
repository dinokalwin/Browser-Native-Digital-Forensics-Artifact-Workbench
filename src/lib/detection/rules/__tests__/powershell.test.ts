import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "powershell";

describe("powershellRule", () => {
  it("fires on 4103/4104 script-block/module logging", () => {
    const events = [makeEvent({ eventId: 4103 }), makeEvent({ eventId: 4104 })];
    const findings = findingsFor(RULE_ID, events);
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe("informational");
  });

  it("fires on 4688 process creation naming powershell.exe", () => {
    const event = makeEvent({
      eventId: 4688,
      message: "New process: C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on 4688 process creation for an unrelated executable", () => {
    const event = makeEvent({
      eventId: 4688,
      message: "New process: C:\\Program Files\\App\\app.exe",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
