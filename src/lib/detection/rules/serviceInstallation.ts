/** Rule: Service Installation — a new service was installed (Event ID 7045 or 4697), a common persistence mechanism. */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "service-installation";

function run(ctx: DetectionContext): DetectionFinding[] {
  return [...eventsFor(ctx, 7045), ...eventsFor(ctx, 4697)].map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "Service Installation",
    eventId: e.id,
    title: "New service installed",
    description: `A service was installed on ${e.computer} at ${e.timestamp}: ${e.message}`,
    severity: "warning" as const,
    mitreTechnique: "T1543.003",
    recommendation:
      "Verify the service binary path and account are expected. New services are a common persistence mechanism for malware and post-exploitation tooling.",
  }));
}

export const serviceInstallationRule: DetectionRule = {
  id: RULE_ID,
  name: "Service Installation",
  description: "A new service was installed (Event ID 7045 or 4697).",
  run,
};
