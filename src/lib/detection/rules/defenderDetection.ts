/** Rule: Defender Detection — Windows Defender reported a malware detection (Event ID 1116). */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "defender-detection";

function run(ctx: DetectionContext): DetectionFinding[] {
  return eventsFor(ctx, 1116).map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "Defender Detection",
    eventId: e.id,
    title: "Malware detected by Windows Defender",
    description: `Windows Defender reported a detection on ${e.computer} at ${e.timestamp}: ${e.message}`,
    severity: "critical" as const,
    mitreTechnique: "T1204",
    recommendation:
      "Confirm the detected item was quarantined/removed and investigate how it arrived on the host (email attachment, download, removable media, etc.).",
  }));
}

export const defenderDetectionRule: DetectionRule = {
  id: RULE_ID,
  name: "Defender Detection",
  description: "Windows Defender reported a malware detection (Event ID 1116).",
  run,
};
