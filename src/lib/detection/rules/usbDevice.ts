/**
 * Rule: USB Device — USB storage device activity, detected either by
 * known event codes (DriverFrameworks-UserMode 20001, PnP 2003/2010) or by
 * a message/provider mentioning USBSTOR/removable storage, since USB
 * device logging varies by Windows version and audit policy.
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "usb-device";
const USB_PATTERN = /usbstor|removable storage/i;

function run(ctx: DetectionContext): DetectionFinding[] {
  const byCode = [...eventsFor(ctx, 20001), ...eventsFor(ctx, 2003), ...eventsFor(ctx, 2010)];
  const byMessage = ctx.events.filter((e) => USB_PATTERN.test(e.message) || USB_PATTERN.test(e.provider));

  const seen = new Set<string>();
  const findings: DetectionFinding[] = [];
  for (const e of [...byCode, ...byMessage]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    findings.push({
      id: makeFindingId(RULE_ID),
      ruleId: RULE_ID,
      ruleName: "USB Device",
      eventId: e.id,
      title: "USB storage device activity",
      description: `USB storage device activity was logged on ${e.computer} at ${e.timestamp}.`,
      severity: "informational",
      mitreTechnique: "T1052.001",
      recommendation:
        "Confirm the device and user are authorized. USB storage is a common data-exfiltration and initial-access vector.",
    });
  }
  return findings;
}

export const usbDeviceRule: DetectionRule = {
  id: RULE_ID,
  name: "USB Device",
  description: "USB storage device activity (DriverFrameworks/PnP events, or USBSTOR references).",
  run,
};
