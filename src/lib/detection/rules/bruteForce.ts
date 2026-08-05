/**
 * Rule: Brute Force — 5 or more failed logons (Event ID 4625) for the same
 * account/host within a 15-minute window. Ported from the pre-existing
 * `backend/suspicious-detection.ts` (kept in place, unmodified, but no
 * longer wired into the live pipeline — see backend/index.ts).
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor, groupBy, sortByTimestamp, userHostKey } from "../utils";

const RULE_ID = "brute-force";
const WINDOW_MS = 15 * 60 * 1000;
const THRESHOLD = 5;

function run(ctx: DetectionContext): DetectionFinding[] {
  const failed = sortByTimestamp(eventsFor(ctx, 4625));
  const byUser = groupBy(failed, userHostKey);

  const findings: DetectionFinding[] = [];
  for (const [key, group] of byUser) {
    // Two-pointer sliding window: each group is already sorted
    // chronologically, so one forward pass finds every 15-minute window in
    // O(n) per group instead of re-scanning the group for every element.
    let windowStart = 0;
    for (let i = 0; i < group.length; i += 1) {
      const currentTime = new Date(group[i].timestamp).getTime();
      while (currentTime - new Date(group[windowStart].timestamp).getTime() >= WINDOW_MS) {
        windowStart += 1;
      }
      const windowSize = i - windowStart + 1;
      if (windowSize >= THRESHOLD) {
        const last = group[i];
        const [user, computer] = key.split("@");
        findings.push({
          id: makeFindingId(RULE_ID),
          ruleId: RULE_ID,
          ruleName: "Brute Force",
          eventId: last.id,
          title: "Possible brute-force logon attempts",
          description: `${windowSize} failed logons for ${user} on ${computer} within 15 minutes (ending ${last.timestamp}).`,
          severity: "critical",
          mitreTechnique: "T1110",
          recommendation:
            "Identify the source of the failed logons and confirm whether the account was ultimately compromised. Consider enforcing account lockout policies and MFA.",
        });
        break; // one finding per user/host pair is enough signal
      }
    }
  }
  return findings;
}

export const bruteForceRule: DetectionRule = {
  id: RULE_ID,
  name: "Brute Force",
  description: "5 or more failed logons (Event ID 4625) for the same account within a 15-minute window.",
  run,
};
