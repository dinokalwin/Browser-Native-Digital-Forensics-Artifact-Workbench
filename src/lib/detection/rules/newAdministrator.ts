/**
 * Rule: New Administrator — an account was added to an administrative
 * security group (Event ID 4728 global / 4732 local / 4756 universal),
 * where the group name in the event message indicates an admin-tier group.
 * Distinct from a generic group-membership change: scoped specifically to
 * admin/privileged groups, at a higher severity.
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "new-administrator";
const ADMIN_GROUP_PATTERN = /administrators|domain admins|enterprise admins|schema admins/i;

function run(ctx: DetectionContext): DetectionFinding[] {
  const candidates = [...eventsFor(ctx, 4728), ...eventsFor(ctx, 4732), ...eventsFor(ctx, 4756)];

  return candidates
    .filter((e) => ADMIN_GROUP_PATTERN.test(e.message))
    .map((e) => ({
      id: makeFindingId(RULE_ID),
      ruleId: RULE_ID,
      ruleName: "New Administrator",
      eventId: e.id,
      title: "Account added to an administrative group",
      description: `${e.user} added a member to an administrative security group on ${e.computer} at ${e.timestamp}.`,
      severity: "critical" as const,
      mitreTechnique: "T1098",
      recommendation:
        "Verify this privilege escalation was authorized. Unauthorized additions to administrative groups are one of the highest-value indicators of compromise.",
    }));
}

export const newAdministratorRule: DetectionRule = {
  id: RULE_ID,
  name: "New Administrator",
  description: "An account was added to an administrative security group (4728/4732/4756).",
  run,
};
