/**
 * Detection Engine 2.0 — Windows path classification (Phase 5.13).
 *
 * Pure, framework-free: no React, no Zustand, no UI. Classifies a raw
 * path/command-line string (as it appears inside an `EvtxEvent.message`
 * field — e.g. a service's ImagePath, a scheduled task's Action, a
 * process's CommandLine) into a coarse trust bucket, WITHOUT ever
 * declaring the underlying file "safe" — see `PATH_CLASSIFICATION_MEANING`
 * below and this phase's ticket section 5 ("TRUSTED PATH != TRUSTED
 * FILE"). A classification is one input signal `contextScoring.ts` weighs
 * alongside several others, never a verdict on its own.
 *
 * "Do not rely on simple substring checks alone" (ticket section 3) is
 * satisfied by `normalizeForClassification`: before any pattern is tested,
 * the input is lowercased, quote-stripped, slash-direction-normalized, and
 * scanned for both a path's expanded form (`C:\Windows\System32`) AND its
 * unexpanded environment-variable form (`%SystemRoot%`) — both forms are
 * matched directly by the same regex set (see the doc comment on
 * `CLASSIFICATION_PATTERNS`), rather than requiring env-var expansion to
 * succeed before classification can happen at all.
 */

export type PathClassification =
  | "trusted-system"
  | "trusted-application"
  | "user-writable"
  | "temporary"
  | "download"
  | "unknown";

/** What each bucket actually asserts — deliberately weak claims. Surfaced
 * in the UI (`EventDetailsDrawer`'s "Why was this detected?" section) so
 * an analyst never mistakes "trusted-application" for "verified safe". */
export const PATH_CLASSIFICATION_MEANING: Record<PathClassification, string> = {
  "trusted-system": "Located under a core Windows system directory — a strong legitimacy signal, not proof.",
  "trusted-application": "Located under a standard application-install directory — a moderate legitimacy signal, not proof; malware can be installed there too.",
  "user-writable": "Located under a user profile directory an ordinary process can write to — a mild suspicion signal.",
  temporary: "Located under a Temp directory — a strong suspicion signal; legitimate installers pass through Temp but rarely persist there.",
  download: "Located under a Downloads directory — a moderate suspicion signal for anything other than a fresh, user-initiated install.",
  unknown: "Path could not be classified from the available text — no legitimacy or suspicion signal either way.",
};

export interface PathClassificationResult {
  classification: PathClassification;
  /** The specific pattern/segment that matched, for the explanation UI —
   * e.g. `"\\appdata\\local\\temp\\"`. `null` for "unknown" (nothing
   * matched) or when no path-like text was supplied at all. */
  matchedSegment: string | null;
}

/**
 * Lowercases, strips surrounding quotes, and normalizes slash direction —
 * everything downstream (`CLASSIFICATION_PATTERNS`) is written against
 * this normalized form. Deliberately does NOT strip command-line
 * arguments: a directory-segment pattern like `\appdata\local\temp\`
 * still matches correctly no matter what follows it on the same line, so
 * skipping tokenization keeps this both simpler and robust to whatever
 * argument syntax a given executable uses.
 */
export function normalizeForClassification(raw: string): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\//g, "\\")
    .toLowerCase();
}

/**
 * Ordered, most-specific-first. Each pattern matches EITHER the expanded
 * Windows path form OR the equivalent `%ENV_VAR%` form (ticket's worked
 * examples: `%SystemRoot%\System32`, `C:\Windows\System32`,
 * `C:\Program Files\`, `C:\Users\...\AppData\Local\Temp\`) — order matters
 * because e.g. Temp must be checked before the broader AppData/Users
 * patterns, or every Temp path would misclassify as merely
 * "user-writable".
 */
const CLASSIFICATION_PATTERNS: Array<{ classification: PathClassification; pattern: RegExp }> = [
  // Temporary — checked first: the most specific and highest-signal bucket.
  { classification: "temporary", pattern: /\\appdata\\local\\temp\\|%temp%|%tmp%|\\windows\\temp\\/ },
  // Downloads — user-initiated but not (yet) installed anywhere trusted.
  { classification: "download", pattern: /\\downloads\\/ },
  // Trusted system — core OS directories.
{
  classification: "trusted-system",
  pattern:
    /\\windows\\system32\\|\\windows\\syswow32\\|\\systemroot\\system32\\|\\systemroot\\syswow64\\|system32\\drivers\\wd\\|%systemroot%|%windir%|^c:\\windows\\|\\windows\\servicing\\|\\windows\\winsxs\\/,
},
  // Trusted application — standard install locations, including the
  // modern WindowsApps (MSIX/Store) directory and ProgramData.
  {
    classification: "trusted-application",
    pattern: /\\program files\s*\(x86\)\\|\\program files\\|%programfiles%|%programfiles\(x86\)%|\\windowsapps\\|\\programdata\\|%programdata%/,
  },
  // User-writable — AppData (Roaming/Local, excluding Temp already
  // matched above), Desktop, Public, or a bare user-profile path.
  {
    classification: "user-writable",
    pattern: /\\appdata\\roaming\\|\\appdata\\local\\|%appdata%|%localappdata%|\\users\\public\\|%public%|\\desktop\\|\\users\\[^\\]+\\|%userprofile%/,
  },
];

/**
 * Classifies one raw path/command-line string. Never throws: an empty,
 * whitespace-only, or entirely unrecognized string returns
 * `{ classification: "unknown", matchedSegment: null }` rather than
 * throwing or guessing — matching this project's "never throw on missing/
 * unexpected data" contract.
 */
export function classifyPath(raw: string | null | undefined): PathClassificationResult {
  if (!raw) return { classification: "unknown", matchedSegment: null };
  const normalized = normalizeForClassification(raw);
  if (normalized.length === 0) return { classification: "unknown", matchedSegment: null };

  for (const { classification, pattern } of CLASSIFICATION_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return { classification, matchedSegment: match[0] };
  }

  return { classification: "unknown", matchedSegment: null };
}

/**
 * Best-effort extraction of just the executable/file path from a longer
 * command line, for DISPLAY purposes only (`getFindingExplanation()`) —
 * classification itself (`classifyPath` above) never needs this, since its
 * regexes match anywhere in the full string. Handles the two common
 * shapes: a quoted path (`"C:\Program Files\App\app.exe" -arg`) and a
 * bare leading token (`C:\Windows\System32\svchost.exe -k netsvcs`).
 */
export function extractExecutablePath(commandLine: string | null | undefined): string | null {
  if (!commandLine) return null;
  const trimmed = commandLine.trim();
  if (trimmed.length === 0) return null;

  const quoted = trimmed.match(/^"([^"]+)"/);
  if (quoted) return quoted[1];

  const bareToken = trimmed.match(/^(\S+)/);
  return bareToken ? bareToken[1] : null;
}
