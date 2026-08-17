/**
 * Detection Engine 2.0 — process-text context (Phase 5.13).
 *
 * Pure, framework-free. Looks for known "living-off-the-land" binary
 * (LOLBin) names and command-line obfuscation patterns inside whatever
 * text a finding's source event carries (`EvtxEvent.message`, which for
 * process-creation/script-block events already contains the command
 * line — see `record-mapper.ts`'s `buildFallbackMessage`). Per ticket
 * section 7, none of this marks anything automatically malicious by
 * itself — `contextScoring.ts` is the only place these booleans turn into
 * weighted evidence, and always in combination with other signals.
 */

export type LolbinName =
  | "powershell"
  | "cmd"
  | "wscript"
  | "cscript"
  | "mshta"
  | "rundll32"
  | "regsvr32"
  | "wmic"
  | "wmiprvse"
  | "installutil";

/** Ordered so a more specific match (e.g. "powershell") is tried before a
 * generic one — not currently ambiguous, but keeps future additions safe. */
const LOLBIN_PATTERNS: Array<{ name: LolbinName; pattern: RegExp }> = [
  { name: "powershell", pattern: /\bpowershell(\.exe)?\b|\bpwsh(\.exe)?\b/i },
  { name: "wmiprvse", pattern: /\bwmiprvse(\.exe)?\b/i },
  { name: "wmic", pattern: /\bwmic(\.exe)?\b/i },
  { name: "mshta", pattern: /\bmshta(\.exe)?\b/i },
  { name: "rundll32", pattern: /\brundll32(\.exe)?\b/i },
  { name: "regsvr32", pattern: /\bregsvr32(\.exe)?\b/i },
  { name: "installutil", pattern: /\binstallutil(\.exe)?\b/i },
  { name: "cscript", pattern: /\bcscript(\.exe)?\b/i },
  { name: "wscript", pattern: /\bwscript(\.exe)?\b/i },
  { name: "cmd", pattern: /\bcmd(\.exe)?\b/i },
];

/** Same obfuscation/suspicious-usage pattern list `encodedPowershell.ts`
 * already uses (kept in sync deliberately — both files independently
 * matching the exact same techniques is intentional duplication, not
 * drift: the rule decides whether an EVENT is flagged, this module decides
 * how much a FINDING's confidence should move for it). */
const ENCODED_COMMAND_PATTERNS: RegExp[] = [
  /-enc(odedcommand)?\b/i,
  /downloadstring|downloadfile|webclient/i,
  /invoke-expression|iex\s*\(/i,
  /frombase64string/i,
  /-windowstyle\s+hidden|-w\s+hidden/i,
  /bypass/i,
];

export interface ProcessTextAnalysis {
  /** The first recognized LOLBin name found in the text, or `null`. */
  lolbin: LolbinName | null;
  /** Whether any encoded/obfuscated-command pattern matched. */
  hasEncodedCommand: boolean;
  /** Which specific pattern(s) matched, for the explanation UI. */
  encodedCommandNotes: string[];
}

const ENCODED_COMMAND_NOTES: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /-enc(odedcommand)?\b/i, note: "base64-encoded command (-EncodedCommand)" },
  { pattern: /downloadstring|downloadfile|webclient/i, note: "remote download cmdlet" },
  { pattern: /invoke-expression|iex\s*\(/i, note: "dynamic code execution (IEX)" },
  { pattern: /frombase64string/i, note: "base64 decoding (FromBase64String)" },
  { pattern: /-windowstyle\s+hidden|-w\s+hidden/i, note: "hidden window" },
  { pattern: /bypass/i, note: "execution policy bypass" },
];

/**
 * Analyzes one block of process/command-line text. Never throws: empty or
 * unrecognized text just returns all-negative results.
 */
export function analyzeProcessText(text: string | null | undefined): ProcessTextAnalysis {
  if (!text) return { lolbin: null, hasEncodedCommand: false, encodedCommandNotes: [] };

  const lolbinMatch = LOLBIN_PATTERNS.find((p) => p.pattern.test(text));
  const encodedNotes = ENCODED_COMMAND_NOTES.filter((n) => n.pattern.test(text)).map((n) => n.note);

  return {
    lolbin: lolbinMatch?.name ?? null,
    hasEncodedCommand: encodedNotes.length > 0,
    encodedCommandNotes: encodedNotes,
  };
}

/** Re-exported for `contextScoring.ts`/tests that only need the boolean,
 * without constructing a full `ProcessTextAnalysis`. */
export function hasEncodedCommandPattern(text: string | null | undefined): boolean {
  if (!text) return false;
  return ENCODED_COMMAND_PATTERNS.some((pattern) => pattern.test(text));
}
