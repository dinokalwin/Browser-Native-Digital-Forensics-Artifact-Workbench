/**
 * MITRE ATT&CK Intelligence Dashboard — technique/tactic reference data
 * (Sprint 5.9.1).
 *
 * Pure data only: no React, no aggregation logic. Covers exactly the 13
 * technique IDs the IOC Detection Engine's 14 rules already attach to
 * their findings (src/lib/detection/rules/*.ts, unmodified — verified by
 * grepping every `mitreTechnique:` literal in that directory before
 * writing this file). This is intentionally a *reference table* for this
 * page, not a rewrite of the existing, smaller chart-scoped lookup in
 * `lib/analytics/aggregation.ts` (`TECHNIQUE_TACTIC`, protected/unmodified
 * per this sprint's "Do not modify: Analytics aggregation" instruction) —
 * every tactic assignment below intentionally matches that lookup's
 * classification for the same technique ID, so the Analytics page's
 * "MITRE ATT&CK Coverage" chart and this dedicated page never disagree
 * about which tactic a given technique belongs to, even though the two
 * lookups are independent, duplicated data rather than a shared import
 * (duplicating a small data table across an intentionally-frozen file and
 * a new one is not the same as modifying the frozen file).
 */

/** The 14 MITRE ATT&CK Enterprise tactics, in their canonical kill-chain
 * order — this exact order drives the Coverage Matrix's column order. */
export const MITRE_TACTICS = [
  "Reconnaissance",
  "Resource Development",
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
] as const;

export type MitreTactic = (typeof MITRE_TACTICS)[number];

export interface MitreTechniqueInfo {
  id: string;
  name: string;
  tactic: MitreTactic;
  description: string;
}

/**
 * Reference metadata for every technique ID the detection engine can
 * attach to a finding. Deliberately does NOT attempt to cover the full
 * ATT&CK Enterprise matrix (hundreds of techniques) — only the ones this
 * app's rules actually detect, since a technique this app can never
 * observe has no meaningful "observed/unobserved" state to show.
 */
export const MITRE_TECHNIQUES: Record<string, MitreTechniqueInfo> = {
  T1110: {
    id: "T1110",
    name: "Brute Force",
    tactic: "Credential Access",
    description:
      "Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.",
  },
  "T1136.001": {
    id: "T1136.001",
    name: "Create Account: Local Account",
    tactic: "Persistence",
    description:
      "Adversaries may create a local account to maintain access to victim systems, using it for persistence that does not require deploying a remote access tool.",
  },
  T1098: {
    id: "T1098",
    name: "Account Manipulation",
    tactic: "Persistence",
    description:
      "Adversaries may manipulate accounts to maintain access to victim systems, such as adding a user to a privileged group.",
  },
  "T1059.001": {
    id: "T1059.001",
    name: "Command and Scripting Interpreter: PowerShell",
    tactic: "Execution",
    description:
      "Adversaries may abuse PowerShell commands and scripts for execution, discovery, and lateral movement.",
  },
  T1027: {
    id: "T1027",
    name: "Obfuscated Files or Information",
    tactic: "Defense Evasion",
    description:
      "Adversaries may attempt to make an executable or file difficult to discover or analyze by encrypting, encoding, or otherwise obfuscating its contents.",
  },
  T1204: {
    id: "T1204",
    name: "User Execution",
    tactic: "Execution",
    description:
      "Adversaries may rely on a user taking an action to gain execution, often in conjunction with another technique such as malicious payload delivery.",
  },
  "T1562.001": {
    id: "T1562.001",
    name: "Impair Defenses: Disable or Modify Tools",
    tactic: "Defense Evasion",
    description:
      "Adversaries may disable security tools to avoid possible detection, such as disabling endpoint protection or antivirus features.",
  },
  "T1543.003": {
    id: "T1543.003",
    name: "Create or Modify System Process: Windows Service",
    tactic: "Persistence",
    description:
      "Adversaries may create or modify Windows services to repeatedly execute malicious payloads as part of persistence.",
  },
  "T1053.005": {
    id: "T1053.005",
    name: "Scheduled Task/Job: Scheduled Task",
    tactic: "Persistence",
    description:
      "Adversaries may abuse the Windows Task Scheduler to perform task scheduling for initial or recurring execution of malicious code.",
  },
  "T1052.001": {
    id: "T1052.001",
    name: "Exfiltration Over Physical Medium: Exfiltration over USB",
    tactic: "Exfiltration",
    description:
      "Adversaries may attempt to exfiltrate data over removable media, such as a USB flash drive, to bypass network-based exfiltration detection.",
  },
  "T1070.001": {
    id: "T1070.001",
    name: "Indicator Removal: Clear Windows Event Logs",
    tactic: "Defense Evasion",
    description:
      "Adversaries may clear Windows Event Logs to hide the activity of an intrusion, removing evidence of their operations.",
  },
  "T1021.001": {
    id: "T1021.001",
    name: "Remote Services: Remote Desktop Protocol",
    tactic: "Lateral Movement",
    description:
      "Adversaries may use Valid Accounts to log into a computer using the Remote Desktop Protocol to move laterally within an environment.",
  },
  "T1546.003": {
    id: "T1546.003",
    name: "Event Triggered Execution: WMI Event Subscription",
    tactic: "Persistence",
    description:
      "Adversaries may establish persistence by executing malicious content triggered by a Windows Management Instrumentation (WMI) event subscription.",
  },
};

/** Looks up a technique's reference metadata, or `undefined` for an ID
 * outside this app's known set (e.g. a finding whose `mitreTechnique`
 * doesn't match anything the detection engine currently produces). */
export function getTechniqueInfo(id: string): MitreTechniqueInfo | undefined {
  return MITRE_TECHNIQUES[id];
}

/** Every technique ID this page knows about, in insertion order. */
export function getKnownTechniqueIds(): string[] {
  return Object.keys(MITRE_TECHNIQUES);
}
