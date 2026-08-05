/**
 * Rule: WMI Persistence — a WMI event filter/consumer/binding was
 * registered (WMI-Activity operational event 5861, or any WMI-Activity
 * event whose message references EventFilter/EventConsumer/
 * FilterToConsumerBinding). One of the most common fileless persistence
 * techniques, and rarely appears legitimately outside management tooling.
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "wmi-persistence";
const WMI_PATTERN = /eventconsumer|eventfilter|filtertoconsumerbinding|commandlineeventconsumer/i;

function run(ctx: DetectionContext): DetectionFinding[] {
  const byCode = eventsFor(ctx, 5861);
  const byProvider = ctx.events.filter((e) => /wmi-activity/i.test(e.provider) && WMI_PATTERN.test(e.message));

  const seen = new Set<string>();
  const findings: DetectionFinding[] = [];
  for (const e of [...byCode, ...byProvider]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    findings.push({
      id: makeFindingId(RULE_ID),
      ruleId: RULE_ID,
      ruleName: "WMI Persistence",
      eventId: e.id,
      title: "WMI event subscription registered",
      description: `A WMI event filter/consumer binding was registered on ${e.computer} at ${e.timestamp}.`,
      severity: "critical",
      mitreTechnique: "T1546.003",
      recommendation:
        "Review the filter query, consumer type, and command line closely. WMI event subscriptions are a stealthy persistence mechanism and rarely appear legitimately outside management tooling.",
    });
  }
  return findings;
}

export const wmiPersistenceRule: DetectionRule = {
  id: RULE_ID,
  name: "WMI Persistence",
  description: "A WMI event filter/consumer/binding was registered (WMI-Activity event 5861 or equivalent).",
  run,
};
