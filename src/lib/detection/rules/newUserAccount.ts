/** Rule: New User Account — a local user account was created (Event ID 4720). */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "new-user-account";

function run(ctx: DetectionContext): DetectionFinding[] {
  return eventsFor(ctx, 4720).map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "New User Account",
    eventId: e.id,
    title: "New user account created",
    description: `A new account was created on ${e.computer} by ${e.user} at ${e.timestamp}.`,
    severity: "warning" as const,
    mitreTechnique: "T1136.001",
    recommendation:
      "Confirm this account creation was authorized and matches change-management records. Unexpected account creation is a common persistence technique.",
  }));
}

export const newUserAccountRule: DetectionRule = {
  id: RULE_ID,
  name: "New User Account",
  description: "A new local user account was created (Event ID 4720).",
  run,
};
