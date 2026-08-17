import { describe, expect, it } from "vitest";
import { findingsFor, makeEvent } from "./testHelpers";

const RULE_ID = "usb-device";

describe("usbDeviceRule", () => {
  it("fires on known USB event codes (20001/2003/2010)", () => {
    const events = [
      makeEvent({ eventId: 20001 }),
      makeEvent({ eventId: 2003 }),
      makeEvent({ eventId: 2010 }),
    ];
    const findings = findingsFor(RULE_ID, events);
    expect(findings).toHaveLength(3);
    expect(findings[0].severity).toBe("informational");
    expect(findings[0].mitreTechnique).toBe("T1052.001");
  });

  it("fires on a message referencing USBSTOR even with an unrelated event code", () => {
    const event = makeEvent({
      eventId: 4663,
      message: "Device \\Device\\USBSTOR\\Disk&Ven... was accessed.",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("fires on a provider name mentioning removable storage", () => {
    // USB_PATTERN is /usbstor|removable storage/i — requires the literal
    // space, matching Windows' actual provider name for this channel.
    const event = makeEvent({
      eventId: 4663,
      provider: "Microsoft-Windows-Removable Storage",
      message: "",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });

  it("does not fire on unrelated events", () => {
    const event = makeEvent({
      eventId: 4624,
      provider: "Microsoft-Windows-Security-Auditing",
      message: "logon",
    });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(0);
  });

  it("does not double-count the same event matched by both code and message", () => {
    const event = makeEvent({ eventId: 20001, message: "USBSTOR device inserted." });
    expect(findingsFor(RULE_ID, [event])).toHaveLength(1);
  });
});
