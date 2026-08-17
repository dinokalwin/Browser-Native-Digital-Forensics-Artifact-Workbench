/**
 * Global Investigation Search — relevance ranking (Phase 5.12).
 *
 * Pure, framework-free. Scores one `IndexedEntry` at a time against a
 * `RankingContext` built once per search call by `searchEngine.ts` — this
 * module never touches the index's maps directly and never iterates a
 * result set itself, it only answers "how relevant is this one entry to
 * this one query".
 *
 * Point values follow this phase's ticket exactly ("5. SEARCH RANKING"),
 * with the exact-identifier bonuses (event id / MITRE technique id) kept
 * far above every text-similarity bonus combined, so — per that section's
 * explicit example — searching `4624` always ranks the Event ID 4624
 * result above an event whose message merely contains "4624" somewhere.
 */
import type { IndexedEntry } from "./indexBuilder";

export const RANKING_POINTS = {
  exactEventId: 100,
  exactTechniqueId: 100,
  exactProviderOrComputer: 80,
  exactTitle: 70,
  prefixMatch: 50,
  tokenMatch: 30,
  substringMatch: 15,
  descriptionMatch: 10,
  /** Ceiling for the recency boost — deliberately small relative to every
   * bonus above, so recency can only ever break a near-tie, never promote
   * an irrelevant entry over a genuinely matching one. */
  recencyMax: 8,
} as const;

/** A bare non-negative integer, e.g. `"4624"` — used to detect "the query
 * is (or contains, as a whole token) a plain Event ID" for the exact-id
 * ranking bonus and for `byEventId` index lookups. */
const EXACT_EVENT_ID_PATTERN = /^\d+$/;

/** A MITRE technique id, e.g. `"T1059"` or `"T1059.001"` — case-
 * insensitive on the leading `T`. */
const EXACT_TECHNIQUE_ID_PATTERN = /^t\d{4}(\.\d{3})?$/i;

/** `null` unless `text` (already trimmed) is *entirely* a bare integer —
 * a query like "4624 powershell" doesn't get the exact-id bonus applied
 * to the whole query, but its tokenized `4624` piece still does (see
 * `searchEngine.ts`, which calls this per-token as well as on the whole
 * free-text string). */
export function detectExactEventId(text: string): number | null {
  const trimmed = text.trim();
  if (!EXACT_EVENT_ID_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** `null` unless `text` (already trimmed) matches the MITRE technique id
 * shape — returned upper-cased to match `IndexedEntry.result.techniqueId`
 * and `SearchIndex.byTechniqueId`'s key casing. */
export function detectExactTechniqueId(text: string): string | null {
  const trimmed = text.trim();
  return EXACT_TECHNIQUE_ID_PATTERN.test(trimmed) ? trimmed.toUpperCase() : null;
}

export interface RankingContext {
  /** Normalized (lowercased, trimmed) free-text query, as one string —
   * used for exact-title/prefix/substring/description comparisons. Empty
   * when the query was operators-only (e.g. `type:ioc` with no free
   * text) — in that case every text-similarity bonus below is skipped,
   * and filtering alone (done upstream in `searchEngine.ts`) decides the
   * result set. */
  rawQueryLower: string;
  /** Tokenized free-text query — used for the per-token match bonus. */
  queryTokens: string[];
  /** Set when the free text (as a whole) is a bare Event ID. */
  exactEventId: number | null;
  /** Set when the free text (as a whole) is a MITRE technique id. */
  exactTechniqueId: string | null;
  /** `SearchIndex.latestTimestampMs` — passed through once per search
   * rather than recomputed per entry. */
  latestTimestampMs: number | null;
}

function recencyBoost(timestampMs: number | null, latestTimestampMs: number | null): number {
  if (timestampMs === null || latestTimestampMs === null) return 0;
  const ageMs = latestTimestampMs - timestampMs;
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (ageMs <= oneDayMs) return RANKING_POINTS.recencyMax;
  const oneWeekMs = 7 * oneDayMs;
  if (ageMs <= oneWeekMs) return RANKING_POINTS.recencyMax / 2;
  return 0;
}

/**
 * Scores one entry. Never throws: every field this reads
 * (`title`/`subtitle`/`description`/`provider`/`computer`/`techniqueId`/
 * `eventId`) is either always-present on `SearchResult` or already
 * `undefined`-safe here.
 */
export function scoreEntry(entry: IndexedEntry, ctx: RankingContext): number {
  let score = 0;
  const { result } = entry;
  const title = result.title.toLowerCase();

  // Exact Event ID match — dominant bonus, per this phase's explicit
  // "4624 should prioritize Event ID 4624" requirement.
  if (ctx.exactEventId !== null && result.eventId === ctx.exactEventId) {
    score += RANKING_POINTS.exactEventId;
  }

  // Exact MITRE technique ID match — same dominance for technique lookups.
  if (ctx.exactTechniqueId && result.techniqueId && result.techniqueId.toUpperCase() === ctx.exactTechniqueId) {
    score += RANKING_POINTS.exactTechniqueId;
  }

  if (ctx.rawQueryLower.length > 0) {
    const providerLower = result.provider?.toLowerCase();
    const computerLower = result.computer?.toLowerCase();
    if (providerLower === ctx.rawQueryLower || computerLower === ctx.rawQueryLower) {
      score += RANKING_POINTS.exactProviderOrComputer;
    }

    if (title === ctx.rawQueryLower) {
      score += RANKING_POINTS.exactTitle;
    } else if (title.startsWith(ctx.rawQueryLower)) {
      score += RANKING_POINTS.prefixMatch;
    }
  }

  let tokenMatches = 0;
  for (const token of ctx.queryTokens) {
    if (entry.tokens.has(token)) tokenMatches += 1;
  }
  score += tokenMatches * RANKING_POINTS.tokenMatch;

  if (ctx.rawQueryLower.length > 0) {
    // Substring fallback only when no exact token matched anything — this
    // is what catches a query like "power" against the token "powershell"
    // (tokens are whole words, so "power" alone never equals "powershell"
    // in the `entry.tokens.has(token)` check above) without double-
    // counting entries that already scored via a real token match.
    if (tokenMatches === 0) {
      const haystack = `${title} ${result.subtitle.toLowerCase()}`;
      if (haystack.includes(ctx.rawQueryLower)) score += RANKING_POINTS.substringMatch;
    }

    if (result.description.toLowerCase().includes(ctx.rawQueryLower)) {
      score += RANKING_POINTS.descriptionMatch;
    }
  }

  score += recencyBoost(entry.timestampMs, ctx.latestTimestampMs);

  return score;
}

/**
 * Which fields actually contributed to this entry's match — drives which
 * parts of `SearchResultItem.tsx` highlight the matched text (ticket
 * "13. HIGHLIGHTING") and its screen-reader summary. Computed alongside
 * `scoreEntry` (same inputs, same per-entry cost) rather than re-deriving
 * it from the final score, since a field can contribute to the *set* of
 * matches even when another field's bonus dominates the numeric score.
 */
export function computeMatchedFields(entry: IndexedEntry, ctx: RankingContext): string[] {
  const fields = new Set<string>();
  const { result } = entry;
  const title = result.title.toLowerCase();

  if (ctx.exactEventId !== null && result.eventId === ctx.exactEventId) fields.add("eventId");
  if (ctx.exactTechniqueId && result.techniqueId && result.techniqueId.toUpperCase() === ctx.exactTechniqueId) {
    fields.add("techniqueId");
  }

  if (ctx.rawQueryLower.length > 0) {
    if (result.provider?.toLowerCase() === ctx.rawQueryLower) fields.add("provider");
    if (result.computer?.toLowerCase() === ctx.rawQueryLower) fields.add("computer");
    if (title.includes(ctx.rawQueryLower)) fields.add("title");
    if (result.subtitle.toLowerCase().includes(ctx.rawQueryLower)) fields.add("subtitle");
    if (result.description.toLowerCase().includes(ctx.rawQueryLower)) fields.add("description");
  }

  for (const token of ctx.queryTokens) {
    if (!entry.tokens.has(token)) continue;
    if (title.includes(token)) fields.add("title");
    if (result.subtitle.toLowerCase().includes(token)) fields.add("subtitle");
    if (result.description.toLowerCase().includes(token)) fields.add("description");
  }

  return Array.from(fields);
}
