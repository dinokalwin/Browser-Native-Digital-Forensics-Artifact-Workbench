/**
 * Global Investigation Search — tokenization and advanced query parsing
 * (Phase 5.12).
 *
 * Pure, framework-free: no React, no DOM, no store access. Used by both
 * `indexBuilder.ts` (to tokenize each indexed field once, at build time)
 * and `searchEngine.ts` (to tokenize the free-text portion of a query at
 * search time) — the same tokenization rules on both sides of the index
 * are what let `searchEngine.ts` look tokens up directly in the index's
 * `byToken` map instead of re-scanning anything.
 */
import type { EventLevel } from "@/types/evidence";
import type { DetectionSeverity } from "@/lib/detection/types";
import type { ParsedSearchQuery, SearchFilterType } from "./types";

/** Lowercases, trims, and collapses runs of whitespace to a single space.
 * Deliberately does NOT strip punctuation here — `tokenizeSearchQuery`
 * below is what decides which punctuation is "noise" vs. part of a
 * meaningful identifier, and callers that only need normalized display
 * text (not tokens) use this alone. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Splits on anything that ISN'T a letter, digit, dot, underscore, slash,
 * backslash, or hyphen — the exact punctuation this phase's ticket calls
 * out as needing to survive tokenization:
 *  - `4624` / `4625` — plain digits, untouched.
 *  - `T1059.001` / `T1543.003` — the dot inside a MITRE sub-technique ID
 *    is preserved, so it tokenizes as one token, not two.
 *  - IP addresses (`192.168.1.1`) — dots preserved, same reasoning.
 *  - domains (`evil.com`) — dots preserved.
 *  - file paths (`C:\Windows\System32\cmd.exe`,
 *    `/usr/bin/bash`) — slashes/backslashes/dots preserved; only the
 *    drive-letter colon (`C:`) is lost, since colons are reserved for this
 *    phase's `key:value` advanced query operators (`parseAdvancedQuery`
 *    below strips those out before this function ever sees them) and
 *    treating every colon as identifier punctuation would make the two
 *    concerns ambiguous.
 *
 * Everything else (commas, quotes, parens, most punctuation) is treated as
 * a delimiter, same as plain whitespace.
 */
const TOKEN_DELIMITER_REGEX = /[^a-z0-9._/\\-]+/;

/**
 * `"PowerShell encoded"` -> `["powershell", "encoded"]`,
 * `"T1059.001"` -> `["t1059.001"]`, `"4624"` -> `["4624"]` — exactly this
 * phase's worked examples. Never throws: an empty/whitespace-only/entirely
 * punctuation string returns `[]`.
 */
export function tokenizeSearchQuery(rawText: string): string[] {
  const normalized = normalizeSearchText(rawText);
  if (normalized.length === 0) return [];
  return normalized
    .split(TOKEN_DELIMITER_REGEX)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

const LEVEL_VALUES: readonly EventLevel[] = ["Critical", "Error", "Warning", "Information", "Verbose"];
const SEVERITY_VALUES: readonly DetectionSeverity[] = ["critical", "warning", "informational"];
const TYPE_VALUES: readonly SearchFilterType[] = ["event", "ioc", "mitre", "note", "bookmark", "case", "all"];

/** Phase 5.13 — Detection Engine 2.0. `confidence:` accepts either a bare
 * 0-100 number (used directly as the minimum threshold) or one of these
 * level words, mapped to that level's minimum score per
 * `lib/detection/context/contextScoring.ts#SCORE_CATEGORY_THRESHOLDS`'
 * confidence-level equivalent (`confidenceLevelFor`'s 75/50/25/0 cut
 * points) — so `confidence:high` reads the same way a `confidence:75`
 * threshold search does, matching how an analyst actually thinks about
 * confidence ("at least high") rather than requiring them to know the
 * exact numeric boundary. */
const CONFIDENCE_LEVEL_MIN_SCORE: Record<string, number> = { low: 0, medium: 25, high: 50, critical: 75 };

function matchEnumCaseInsensitive<T extends string>(value: string, allowed: readonly T[]): T | null {
  const lower = value.toLowerCase();
  const match = allowed.find((candidate) => candidate.toLowerCase() === lower);
  return match ?? null;
}

function parseBooleanOperand(value: string): boolean | null {
  const lower = value.toLowerCase();
  if (lower === "true" || lower === "yes" || lower === "1") return true;
  if (lower === "false" || lower === "no" || lower === "0") return false;
  return null;
}

/** Phase 5.13 — shared by `confidence:`/`risk:`. Accepts a bare 0-100
 * number, or (confidence only, via `allowLevelWords`) a level word. Any
 * other value is unrecognized, per this function's existing "invalid
 * operator falls back to free text" contract. */
function parseScoreThresholdOperand(value: string, allowLevelWords: boolean): number | null {
  if (allowLevelWords && value.toLowerCase() in CONFIDENCE_LEVEL_MIN_SCORE) {
    return CONFIDENCE_LEVEL_MIN_SCORE[value.toLowerCase()];
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) return parsed;
  return null;
}

/** Matches one `key:value` token — `value` may be bare (`eventid:4624`) or
 * quoted (`provider:"Microsoft-Windows-Security-Auditing"`), and stops at
 * the next whitespace for the bare form. Case-insensitive on the key. */
const OPERATOR_TOKEN_REGEX = /([a-z]+):(?:"([^"]*)"|(\S+))/gi;

const EMPTY_PARSED_QUERY: ParsedSearchQuery = {
  freeText: "",
  eventId: null,
  provider: null,
  computer: null,
  level: null,
  severity: null,
  mitreTechnique: null,
  type: null,
  bookmarkedOnly: null,
  notesOnly: null,
  minConfidence: null,
  minRisk: null,
};

/**
 * "12. ADVANCED QUERY SYNTAX" — extracts every recognized `key:value`
 * operator from `rawQuery` and returns them alongside whatever free text
 * is left over. Recognized keys: `eventid`, `provider`, `computer`,
 * `level`, `severity`, `technique`, `type`, `bookmark`, `notes`, and
 * (Phase 5.13, additive) `confidence`, `risk`.
 *
 * Never throws, and an unrecognized key or an unparseable value for a
 * recognized key (e.g. `level:bogus`) is treated as ordinary search text
 * instead — this phase's explicit "Invalid operators must not crash
 * search. Treat unknown operators as normal search text" requirement.
 * Concretely: if `key:value` doesn't resolve to a valid filter value, the
 * whole `key:value` substring is left in `freeText` untouched rather than
 * silently dropped, so a mistyped operator still contributes to a plain
 * substring search instead of vanishing.
 */
export function parseAdvancedQuery(rawQuery: string): ParsedSearchQuery {
  if (!rawQuery || rawQuery.trim().length === 0) return { ...EMPTY_PARSED_QUERY };

  const result: ParsedSearchQuery = { ...EMPTY_PARSED_QUERY };
  const consumedRanges: Array<[number, number]> = [];

  OPERATOR_TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPERATOR_TOKEN_REGEX.exec(rawQuery)) !== null) {
    const key = match[1].toLowerCase();
    const operand = (match[2] ?? match[3] ?? "").trim();
    if (operand.length === 0) continue;

    let recognized = false;

    switch (key) {
      case "eventid":
      case "event": {
        const parsed = Number(operand);
        if (Number.isInteger(parsed) && parsed >= 0) {
          result.eventId = parsed;
          recognized = true;
        }
        break;
      }
      case "provider": {
        result.provider = operand;
        recognized = true;
        break;
      }
      case "computer":
      case "host": {
        result.computer = operand;
        recognized = true;
        break;
      }
      case "level": {
        const level = matchEnumCaseInsensitive(operand, LEVEL_VALUES);
        if (level) {
          result.level = level;
          recognized = true;
        }
        break;
      }
      case "severity": {
        const severity = matchEnumCaseInsensitive(operand, SEVERITY_VALUES);
        if (severity) {
          result.severity = severity;
          recognized = true;
        }
        break;
      }
      case "technique":
      case "mitre": {
        result.mitreTechnique = operand.toUpperCase();
        recognized = true;
        break;
      }
      case "type": {
        const type = matchEnumCaseInsensitive(operand, TYPE_VALUES);
        if (type) {
          result.type = type;
          recognized = true;
        }
        break;
      }
      case "bookmark":
      case "bookmarked": {
        const bool = parseBooleanOperand(operand);
        if (bool !== null) {
          result.bookmarkedOnly = bool;
          recognized = true;
        }
        break;
      }
      case "notes":
      case "note": {
        const bool = parseBooleanOperand(operand);
        if (bool !== null) {
          result.notesOnly = bool;
          recognized = true;
        }
        break;
      }
      // Phase 5.13 — Detection Engine 2.0. Additive: `confidence:`/`risk:`
      // narrow to findings at or above a minimum score, same "AND-combine,
      // never widen" semantics as every other operator here.
      case "confidence": {
        const threshold = parseScoreThresholdOperand(operand, true);
        if (threshold !== null) {
          result.minConfidence = threshold;
          recognized = true;
        }
        break;
      }
      case "risk": {
        const threshold = parseScoreThresholdOperand(operand, false);
        if (threshold !== null) {
          result.minRisk = threshold;
          recognized = true;
        }
        break;
      }
      default:
        break;
    }

    if (recognized) {
      consumedRanges.push([match.index, match.index + match[0].length]);
    }
  }

  // Rebuild the free-text remainder by cutting out every consumed
  // `key:value` span, left to right — an unrecognized/invalid operator's
  // span was never added to `consumedRanges`, so it stays in the free
  // text verbatim (searched as plain substring text) rather than being
  // silently discarded.
  if (consumedRanges.length === 0) {
    result.freeText = rawQuery;
  } else {
    consumedRanges.sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    let freeText = "";
    for (const [start, end] of consumedRanges) {
      freeText += rawQuery.slice(cursor, start);
      cursor = end;
    }
    freeText += rawQuery.slice(cursor);
    result.freeText = freeText;
  }

  result.freeText = normalizeSearchText(result.freeText);
  return result;
}
