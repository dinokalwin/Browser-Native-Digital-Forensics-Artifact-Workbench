/**
 * Rule-based suspicious-event detection.
 *
 * Deliberately simple and explainable rather than ML-based: each rule is
 * a small, named function that inspects the parsed events and emits zero
 * or more `SuspiciousFinding`s with a plain-English description and (where
 * applicable) a MITRE ATT&CK technique ID, so an analyst can see exactly
 * why something was flagged. This runs entirely client-side, synchronously,
 * over whatever `evidenceStore.events` currently holds.
 */
import type { EvtxEvent, SuspiciousFinding } from "@/types/evidence";

let findingCounter = 0;
function nextId(): string {
  findingCounter += 1;
  return `finding-${findingCounter}`;
}

const POWERSHELL_SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /-enc(odedcommand)?\b/i, note: "base64-encoded command" },
  { pattern: /downloadstring|downloadfile|webclient/i, note: "remote download cmdlet" },
  { pattern: /invoke-expression|iex\s*\(/i, note: "dynamic code execution (IEX)" },
  { pattern: /frombase64string/i, note: "base64 decoding" },
  { pattern: /-windowstyle\s+hidden|-w\s+hidden/i, note: "hidden window" },
  { pattern: /bypass/i, note: "execution policy bypass" },
];

/** Rule: Windows security audit log was cleared — a common anti-forensics move. */
function detectClearedAuditLog(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 1102)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "Audit log cleared",
      description: `The Security event log was cleared on ${e.computer} by ${e.user} at ${e.timestamp}. This is frequently used to destroy evidence of prior activity.`,
      severity: "critical" as const,
      mitreTechnique: "T1070.001",
    }));
}

/** Rule: 5+ failed logons (4625) for the same user within a 15-minute window — brute force. */
function detectBruteForce(events: EvtxEvent[]): SuspiciousFinding[] {
  const failed = events
    .filter((e) => e.eventId === 4625)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const findings: SuspiciousFinding[] = [];
  const byUser = new Map<string, EvtxEvent[]>();
  for (const e of failed) {
    const key = `${e.user}@${e.computer}`;
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key)!.push(e);
  }

  const WINDOW_MS = 15 * 60 * 1000;
  // Two-pointer sliding window per user group: each group is already
  // sorted chronologically (inherited from `failed`'s sort above), so a
  // single forward pass with a trailing pointer finds every 15-minute
  // window in O(n) per group instead of the O(n^2) that re-scanning the
  // whole group with .filter() for every element would cost — the
  // previous version did exactly that, which meant an account with many
  // failed logons (the brute-force scenario this rule exists to detect)
  // was the specific case that got slowest.
  for (const [key, group] of byUser) {
    let windowStart = 0;
    for (let i = 0; i < group.length; i++) {
      const currentTime = new Date(group[i].timestamp).getTime();
      while (currentTime - new Date(group[windowStart].timestamp).getTime() >= WINDOW_MS) {
        windowStart++;
      }
      const windowSize = i - windowStart + 1;
      if (windowSize >= 5) {
        const last = group[i];
        findings.push({
          id: nextId(),
          eventId: last.id,
          title: "Possible brute-force logon attempts",
          description: `${windowSize} failed logons for ${key.split("@")[0]} on ${key.split("@")[1]} within 15 minutes (ending ${last.timestamp}).`,
          severity: "critical",
          mitreTechnique: "T1110",
        });
        break; // one finding per user/host pair is enough signal
      }
    }
  }
  return findings;
}

/** Rule: new local user account created. */
function detectAccountCreated(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 4720)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "New user account created",
      description: `A new account was created on ${e.computer} by ${e.user} at ${e.timestamp}. Verify this was expected.`,
      severity: "warning" as const,
      mitreTechnique: "T1136.001",
    }));
}

/** Rule: account added to a security-enabled group (potential privilege escalation). Covers both global (4728) and local (4732) group membership changes — same underlying signal, different scope. */
function detectGroupMembershipChange(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 4728 || e.eventId === 4732)
    .map((e) => {
      const scope = e.eventId === 4728 ? "global" : "local";
      return {
        id: nextId(),
        eventId: e.id,
        title: "Account added to a security group",
        description: `${e.user} added a member to a security-enabled ${scope} group on ${e.computer} at ${e.timestamp}. Could indicate privilege escalation.`,
        severity: "warning" as const,
        mitreTechnique: "T1098",
      };
    });
}

/** Rule: a new service was installed — common persistence mechanism. */
function detectServiceInstalled(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 7045 || e.eventId === 4697)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "New service installed",
      description: `A service was installed on ${e.computer} at ${e.timestamp}: ${e.message}`,
      severity: "warning" as const,
      mitreTechnique: "T1543.003",
    }));
}

/** Rule: Windows Defender flagged malware. */
function detectDefenderDetection(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 1116)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "Malware detected by Windows Defender",
      description: `Windows Defender reported a detection on ${e.computer} at ${e.timestamp}: ${e.message}`,
      severity: "critical" as const,
    }));
}

/** Rule: PowerShell script block containing known-suspicious patterns. */
function detectSuspiciousPowerShell(events: EvtxEvent[]): SuspiciousFinding[] {
  const findings: SuspiciousFinding[] = [];
  for (const e of events) {
    if (e.eventId !== 4103 && e.eventId !== 4104) continue;
    const matched = POWERSHELL_SUSPICIOUS_PATTERNS.filter((p) => p.pattern.test(e.message));
    if (matched.length === 0) continue;
    findings.push({
      id: nextId(),
      eventId: e.id,
      title: "Suspicious PowerShell activity",
      description: `PowerShell on ${e.computer} (${e.user}) at ${e.timestamp} matched: ${matched.map((m) => m.note).join(", ")}.`,
      severity: "critical",
      mitreTechnique: "T1059.001",
    });
  }
  return findings;
}

/** Rule: logon attempted using explicit credentials (4648) — common in legitimate RunAs/scheduled-task use, but also a signature of lateral-movement tooling presenting alternate credentials. */
function detectExplicitCredentialLogon(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 4648)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "Explicit credential logon",
      description: `${e.user} logged on to ${e.computer} at ${e.timestamp} using explicitly supplied credentials rather than the current session's. Common for RunAs/scheduled tasks, but also seen with lateral-movement tooling — review if unexpected.`,
      severity: "informational" as const,
      mitreTechnique: "T1078",
    }));
}

/** Rule: special/administrative privileges assigned to a new logon (4672). Fires on essentially every legitimate admin/interactive privileged logon, so kept at informational severity — most useful correlated with other findings, not as a standalone alert. */
function detectPrivilegedLogon(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 4672)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "Privileged logon",
      description: `${e.user} logged on to ${e.computer} at ${e.timestamp} with special/administrative privileges assigned. Routine for legitimate admin sessions — review alongside surrounding activity, not in isolation.`,
      severity: "informational" as const,
      mitreTechnique: "T1078",
    }));
}

/** Rule: user account locked out (4740) — usually a consequence of repeated failed logons rather than an attack step in itself. */
function detectAccountLockedOut(events: EvtxEvent[]): SuspiciousFinding[] {
  return events
    .filter((e) => e.eventId === 4740)
    .map((e) => ({
      id: nextId(),
      eventId: e.id,
      title: "Account locked out",
      description: `${e.user} was locked out on ${e.computer} at ${e.timestamp}, typically a consequence of repeated failed logon attempts. Cross-reference with brute-force findings above.`,
      severity: "warning" as const,
      mitreTechnique: "T1110",
    }));
}

const RULES = [
  detectClearedAuditLog,
  detectBruteForce,
  detectAccountCreated,
  detectGroupMembershipChange,
  detectServiceInstalled,
  detectDefenderDetection,
  detectSuspiciousPowerShell,
  detectExplicitCredentialLogon,
  detectPrivilegedLogon,
  detectAccountLockedOut,
];

export async function detectSuspiciousEvents(events: EvtxEvent[]): Promise<SuspiciousFinding[]> {
  const findings = RULES.flatMap((rule) => rule(events));
  // Most severe first, then chronological by referenced event where possible.
  const severityRank: Record<SuspiciousFinding["severity"], number> = {
    critical: 0,
    warning: 1,
    informational: 2,
  };
  return findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
