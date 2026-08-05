/**
 * Rule: Successful Login after Failures — a run of 3+ failed logons (4625)
 * for the same account/host, followed by a successful logon (4624) for
 * that same account/host within 30 minutes of the last failure. A much
 * stronger compromise signal than either event alone: it means the
 * password guessing eventually worked.
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor, groupBy, sortByTimestamp, userHostKey } from "../utils";

const RULE_ID = "successful-login-after-failures";
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const SUCCESS_WINDOW_MS = 30 * 60 * 1000;

function run(ctx: DetectionContext): DetectionFinding[] {
  const failed = sortByTimestamp(eventsFor(ctx, 4625));
  const success = sortByTimestamp(eventsFor(ctx, 4624));
  const failedByUser = groupBy(failed, userHostKey);
  const successByUser = groupBy(success, userHostKey);

  const findings: DetectionFinding[] = [];
  for (const [key, group] of failedByUser) {
    let windowStart = 0;
    let clusterEndTime: number | null = null;
    let clusterEndEvent = group[0];

    for (let i = 0; i < group.length; i += 1) {
      const t = new Date(group[i].timestamp).getTime();
      while (t - new Date(group[windowStart].timestamp).getTime() >= FAILURE_WINDOW_MS) {
        windowStart += 1;
      }
      if (i - windowStart + 1 >= FAILURE_THRESHOLD) {
        clusterEndTime = t;
        clusterEndEvent = group[i];
        break;
      }
    }
    if (clusterEndTime === null) continue;
    const clusterEnd: number = clusterEndTime;

    const successes = successByUser.get(key) ?? [];
    const match = successes.find((s) => {
      const st = new Date(s.timestamp).getTime();
      return st >= clusterEnd && st - clusterEnd <= SUCCESS_WINDOW_MS;
    });
    if (!match) continue;

    const [user, computer] = key.split("@");
    findings.push({
      id: makeFindingId(RULE_ID),
      ruleId: RULE_ID,
      ruleName: "Successful Login after Failures",
      eventId: match.id,
      title: "Successful logon following repeated failures",
      description: `${user} successfully logged on to ${computer} at ${match.timestamp}, shortly after repeated failed logon attempts (last failure ${clusterEndEvent.timestamp}). Consistent with a successful brute-force or password-guessing attack.`,
      severity: "critical",
      mitreTechnique: "T1110",
      recommendation:
        "Treat this account as potentially compromised: force a password reset, review subsequent activity for lateral movement or data access, and confirm the successful logon was expected.",
    });
  }
  return findings;
}

export const successfulLoginAfterFailuresRule: DetectionRule = {
  id: RULE_ID,
  name: "Successful Login after Failures",
  description: "A successful logon (4624) shortly after a cluster of 3+ failed logons (4625) for the same account.",
  run,
};
