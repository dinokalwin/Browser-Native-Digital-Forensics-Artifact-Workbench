/**
 * Rule: RDP Logon — a Remote Desktop logon, detected via a successful
 * logon (4624) with LogonType 10 (RemoteInteractive) in the message, or
 * TerminalServices-RemoteConnectionManager's own "authentication
 * succeeded" event (1149). Informational by default — RDP itself is
 * routine, not inherently malicious.
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "rdp-logon";
const LOGON_TYPE_10_PATTERN = /logon type:\s*10\b/i;

function run(ctx: DetectionContext): DetectionFinding[] {
  const via4624 = eventsFor(ctx, 4624).filter((e) => LOGON_TYPE_10_PATTERN.test(e.message));
  const via1149 = eventsFor(ctx, 1149);

  return [...via4624, ...via1149].map((e) => ({
    id: makeFindingId(RULE_ID),
    ruleId: RULE_ID,
    ruleName: "RDP Logon",
    eventId: e.id,
    title: "Remote Desktop (RDP) logon",
    description: `${e.user || "A user"} logged on to ${e.computer} via Remote Desktop at ${e.timestamp}.`,
    severity: "informational" as const,
    mitreTechnique: "T1021.001",
    recommendation:
      "Confirm RDP access was expected for this account, host, and time. Correlate with VPN/firewall logs if RDP may have been exposed externally.",
  }));
}

export const rdpLogonRule: DetectionRule = {
  id: RULE_ID,
  name: "RDP Logon",
  description: "A Remote Desktop logon (4624 with LogonType 10, or TerminalServices event 1149).",
  run,
};
