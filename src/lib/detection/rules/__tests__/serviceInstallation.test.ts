import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "service-installation";

describe("serviceInstallationRule", () => {
  it("fires on Event ID 7045 (new service installed)", () => {
    const event = makeEvent({
      eventId: 7045,
      message:
        "A service was installed. Service Name: TestSvc  Service File Name: C:\\Temp\\evil.exe",
    });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].mitreTechnique).toBe("T1543.003");
  });

  it("fires on Event ID 4697 (service installed, Security log)", () => {
    const event = makeEvent({ eventId: 4697, message: "A service was installed in the system." });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on an adjacent, non-matching event code", () => {
    const event = makeEvent({ eventId: 7040 });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
