/** Rule: Defender Disabled — Windows Defender real-time protection was disabled (Event ID 5001). */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "defender-disabled";

function run(ctx: DetectionContext): DetectionFinding[] {
  return eventsFor(ctx, 5001).map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "Defender Disabled",
    eventId: e.id,
    title: "Windows Defender real-time protection disabled",
    description: `Windows Defender's real-time protection was disabled on ${e.computer} at ${e.timestamp}.`,
    severity: "critical" as const,
    mitreTechnique: "T1562.001",
    recommendation:
      "Confirm this was an authorized administrative action. Disabling endpoint protection is a common step immediately before deploying malware or attack tooling.",
  }));
}

export const defenderDisabledRule: DetectionRule = {
  id: RULE_ID,
  name: "Defender Disabled",
  description: "Windows Defender real-time protection was disabled (Event ID 5001).",
  run,
};
