/**
 * Rule: PowerShell — general PowerShell execution visibility. Fires on
 * script block / module logging (4103/4104) or a process-creation event
 * (4688) naming powershell.exe/pwsh.exe. Kept at informational severity —
 * this is baseline visibility, not a suspicious-pattern match (see
 * `encodedPowershell.ts` for the higher-severity obfuscation-specific
 * rule, which fires independently and may double-flag the same event).
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "powershell";
const PS_PROCESS_PATTERN = /powershell(\.exe)?|pwsh(\.exe)?/i;

function run(ctx: DetectionContext): DetectionFinding[] {
  const scriptEvents = [...eventsFor(ctx, 4103), ...eventsFor(ctx, 4104)];
  const processEvents = eventsFor(ctx, 4688).filter((e) => PS_PROCESS_PATTERN.test(e.message));

  return [...scriptEvents, ...processEvents].map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "PowerShell",
    eventId: e.id,
    title: "PowerShell execution observed",
    description: `PowerShell activity was logged on ${e.computer} (${e.user}) at ${e.timestamp}.`,
    severity: "informational" as const,
    mitreTechnique: "T1059.001",
    recommendation:
      "Review the command/script content for legitimacy. PowerShell is used constantly for routine administration, but is also the most common post-exploitation execution tool.",
  }));
}

export const powershellRule: DetectionRule = {
  id: RULE_ID,
  name: "PowerShell",
  description: "PowerShell script block/module logging (4103/4104) or process creation naming powershell.exe.",
  run,
};
