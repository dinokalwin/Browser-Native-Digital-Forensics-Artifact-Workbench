/**
 * Rule: Encoded PowerShell — PowerShell activity (4103/4104/4688) whose
 * message matches known obfuscation/suspicious-usage patterns: base64
 * encoding, remote download cmdlets, dynamic code execution, hidden
 * windows, or execution-policy bypass. Ported from the pre-existing
 * `backend/suspicious-detection.ts` pattern list.
 */
import type { DetectionContext, DetectionFinding, DetectionRule } from "../types";
import { makeFindingId } from "../types";
import { eventsFor } from "../utils";

const RULE_ID = "encoded-powershell";

const PATTERNS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /-enc(odedcommand)?\b/i, note: "base64-encoded command" },
  { pattern: /downloadstring|downloadfile|webclient/i, note: "remote download cmdlet" },
  { pattern: /invoke-expression|iex\s*\(/i, note: "dynamic code execution (IEX)" },
  { pattern: /frombase64string/i, note: "base64 decoding" },
  { pattern: /-windowstyle\s+hidden|-w\s+hidden/i, note: "hidden window" },
  { pattern: /bypass/i, note: "execution policy bypass" },
];

function run(ctx: DetectionContext): DetectionFinding[] {
  const candidates = [...eventsFor(ctx, 4103), ...eventsFor(ctx, 4104), ...eventsFor(ctx, 4688)];
  const findings: DetectionFinding[] = [];

  for (const e of candidates) {
    const matched = PATTERNS.filter((p) => p.pattern.test(e.message));
    if (matched.length === 0) continue;
    findings.push({
      id: makeFindingId(RULE_ID),
      ruleId: RULE_ID,
      ruleName: "Encoded PowerShell",
      eventId: e.id,
      title: "Suspicious / encoded PowerShell activity",
      description: `PowerShell on ${e.computer} (${e.user}) at ${e.timestamp} matched: ${matched.map((m) => m.note).join(", ")}.`,
      severity: "critical",
      mitreTechnique: "T1027",
      recommendation:
        "Decode and review the full command line. Encoded/obfuscated PowerShell is a strong indicator of malicious tooling (droppers, in-memory execution, C2 staging).",
    });
  }
  return findings;
}

export const encodedPowershellRule: DetectionRule = {
  id: RULE_ID,
  name: "Encoded PowerShell",
  description: "PowerShell activity matching known obfuscation/suspicious-usage patterns (base64, IEX, bypass, hidden window).",
  run,
};
