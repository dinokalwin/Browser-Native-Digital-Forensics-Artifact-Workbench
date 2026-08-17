import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "encoded-powershell";

describe("encodedPowershellRule", () => {
  it("fires on 4104 script-block logging containing a base64 -enc flag", () => {
    const event = makeEvent({
      eventId: 4104,
      message: "powershell.exe -enc SQBFAFgA...",
    });
    const findings = findingsFor(RULE_ID, [event]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].mitreTechnique).toBe("T1027");
  });

  it("fires on 4688 process creation containing a download cmdlet + bypass", () => {
    const event = makeEvent({
      eventId: 4688,
      message:
        'powershell.exe -ExecutionPolicy Bypass -Command "(New-Object Net.WebClient).DownloadString(...)"',
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on ordinary PowerShell activity with no suspicious pattern", () => {
    const event = makeEvent({
      eventId: 4104,
      message: "Get-Process | Where-Object { $_.CPU -gt 10 }",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });

  it("does not fire on an event code the rule doesn't consider", () => {
    const event = makeEvent({ eventId: 4624, message: "-enc SQBFAFgA" });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });
});
