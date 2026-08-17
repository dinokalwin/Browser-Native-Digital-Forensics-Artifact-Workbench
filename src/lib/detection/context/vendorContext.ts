/**
 * Detection Engine 2.0 — vendor/naming heuristics (Phase 5.13).
 *
 * Pure, framework-free. Deliberately NOT an exhaustive vendor database —
 * ticket section 4 explicitly warns against "an enormous hardcoded vendor
 * allowlist". `KNOWN_VENDOR_FRAGMENTS` below is a small, maintainable set
 * of common vendor/product name fragments (the exact ones the ticket names
 * as examples, plus a handful of equally common others) used as ONE weak
 * positive signal among several in `contextScoring.ts` — a name match here
 * is never sufficient on its own to call anything safe (see this module's
 * `matchKnownVendor` doc comment). The maintainable part is structural:
 * this is a flat array of lowercase substrings checked with `.includes()`,
 * so extending it is a one-line addition, not a rule-engine change.
 */

/** Small, deliberately non-exhaustive. Matched as case-insensitive
 * substrings against service name / display name / image path text — see
 * `matchKnownVendor`. */
const KNOWN_VENDOR_FRAGMENTS: readonly string[] = [
  "microsoft",
  "windows",
  "virtualbox",
  "vbox",
  "oracle",
  "google",
  "chrome",
  "nvidia",
  "intel",
  "hewlett",
  "hp inc",
  "hpsupport",
  "protonvpn",
  "proton",
  // Phase 5.13.1 — named directly in the false-positive-amplification
  // report as a legitimate service-install burst (VPN client installing
  // its VPN service alongside the Wintun/WireGuard tunnel driver it
  // bundles) that was mutually inflating confidence via the correlation
  // signal before this vendor list recognized either of them.
  "wireguard",
  "wintun",
  "vmware",
  "docker",
  "mongodb",
  "adobe",
  "mozilla",
  "firefox",
  "realtek",
  "logitech",
  "dell",
  "lenovo",
  "amd",
  "broadcom",
  "apple",
  "dropbox",
  "zoom",
  "slack technologies",
  "cisco",
  "citrix",
  "steam",
  "epic games",
  "avast",
  "mcafee",
  "symantec",
  "norton",
  "crowdstrike",
  "sentinelone",
  "brave",
];

export interface VendorMatch {
  matched: boolean;
  /** The known-vendor fragment that matched, e.g. `"virtualbox"`. */
  vendor: string | null;
  /** Which candidate string it matched against — kept for the explanation
   * UI ("Known vendor fragment found in service display name"). */
  source: "service-name" | "display-name" | "image-path" | "other" | null;
}

const NO_MATCH: VendorMatch = { matched: false, vendor: null, source: null };

/**
 * Checks `candidates` (service name, display name, image path — whatever
 * text is actually available for this finding) against
 * `KNOWN_VENDOR_FRAGMENTS`, in the given order, returning the first hit.
 * A match is a WEAK positive signal only (`contextScoring.ts` gives it a
 * small negative weight, see `RISK_WEIGHTS.expectedVendor`) — malware
 * routinely fakes vendor-sounding names ("Microsoft Update Helper",
 * "Google Crash Handler"), so this is never treated as confirmation, only
 * as one input alongside path classification and service-naming shape.
 */
export function matchKnownVendor(
  candidates: Array<{ text: string | null | undefined; source: VendorMatch["source"] }>,
): VendorMatch {
  for (const { text, source } of candidates) {
    if (!text) continue;
    const lower = text.toLowerCase();
    const hit = KNOWN_VENDOR_FRAGMENTS.find((fragment) => lower.includes(fragment));
    if (hit) return { matched: true, vendor: hit, source };
  }
  return NO_MATCH;
}

/**
 * Detects a service/file name that LOOKS machine-generated rather than a
 * normal human-chosen product/service name — long hex/GUID-like runs, a
 * high proportion of digits, or an absence of vowels across a long token
 * all correlate with malware's auto-generated service names (ticket's
 * "unusual service name" signal). Deliberately conservative: short names,
 * ordinary product names, and names with normal mixed-case word structure
 * all return `false` — this only flags names that are clearly NOT
 * human-authored, not merely unfamiliar ones (an unfamiliar name is not,
 * by itself, evidence of anything).
 */
export function looksLikeRandomIdentifier(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 8) return false;

  // A GUID or GUID-fragment (32+ hex chars, or the canonical dashed form).
  if (/^[0-9a-f]{16,}$/i.test(trimmed.replace(/-/g, ""))) return true;
  if (/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(trimmed)) return true;

  const letters = trimmed.replace(/[^a-z]/gi, "");
  const digits = trimmed.replace(/[^0-9]/g, "");
  const vowels = trimmed.replace(/[^aeiou]/gi, "");

  // Long, mostly-digit token (e.g. "svc_48291037462").
  if (trimmed.length >= 10 && digits.length / trimmed.length > 0.5) return true;

  // Long, letters-only token with essentially no vowels (e.g. random
  // consonant strings some malware families use, "xkqzmwvpblk") — real
  // words/product names almost never go this long without a vowel.
  if (letters.length >= 10 && vowels.length === 0) return true;

  return false;
}
