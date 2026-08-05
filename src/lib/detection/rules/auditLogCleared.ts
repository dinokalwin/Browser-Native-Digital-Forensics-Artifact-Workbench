/** Rule: Audit Log Cleared — the Security event log was cleared (Event ID 1102), a common anti-forensics move. */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "audit-log-cleared";

function run(ctx: DetectionContext): DetectionFinding[] {
  return eventsFor(ctx, 1102).map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "Audit Log Cleared",
    eventId: e.id,
    title: "Audit log cleared",
    description: `The Security event log was cleared on ${e.computer} by ${e.user} at ${e.timestamp}.`,
    severity: "critical" as const,
    mitreTechnique: "T1070.001",
    recommendation:
      "Treat this as a high-confidence anti-forensics indicator. Correlate with other log sources (network, EDR, backups) covering the same timeframe, since local evidence for that window has been destroyed.",
  }));
}

export const auditLogClearedRule: DetectionRule = {
  id: RULE_ID,
  name: "Audit Log Cleared",
  description: "The Security event log was cleared (Event ID 1102).",
  run,
};
