/** Rule: Scheduled Task — a scheduled task was created/registered (Event ID 4698 or Task Scheduler operational 106). */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "scheduled-task";

function run(ctx: DetectionContext): DetectionFinding[] {
  return [...eventsFor(ctx, 4698), ...eventsFor(ctx, 106)].map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "Scheduled Task",
    eventId: e.id,
    title: "Scheduled task created",
    description: `A scheduled task was created/registered on ${e.computer} at ${e.timestamp}: ${e.message}`,
    severity: "warning" as const,
    mitreTechnique: "T1053.005",
    recommendation:
      "Review the task's action and trigger. Scheduled tasks are a common persistence and execution mechanism.",
  }));
}

export const scheduledTaskRule: DetectionRule = {
  id: RULE_ID,
  name: "Scheduled Task",
  description: "A scheduled task was created or registered (Event ID 4698 or 106).",
  run,
};
