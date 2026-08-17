/**
 * Global Investigation Search — index builder (Phase 5.12).
 *
 * Pure, framework-free: no React, no Zustand, no store access. Takes
 * already-loaded data (`events`/`iocFindings` from `evidenceStore`,
 * `caseNote`/`eventNotes` from `notesStore`, `bookmarks` from
 * `bookmarksStore`, `savedCases` from `caseStore`) and builds one
 * `SearchIndex` — this module never fetches or re-derives any of that data
 * itself, matching this phase's "reuse their public APIs" / "No search
 * component duplicates case storage" rules.
 *
 * MITRE technique entries reuse `aggregateMitreFindings` (Sprint 5.9.1),
 * the same function every other MITRE-aware page in this app already
 * calls from `iocFindings` — this module never re-implements technique
 * grouping or tactic assignment.
 *
 * Performance contract: exactly one pass over each input array (events,
 * iocFindings, event notes, bookmarks, savedCases) — O(n) total, never
 * O(n*m). The `byToken`/`byEventId`/`byTechniqueId` maps built here are
 * what let `searchEngine.ts` avoid a second full scan at query time: a
 * query touches only the entries in the buckets its tokens/exact values
 * actually hit, never the full index.
 */
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type { CaseNote, EventNoteMap } from "@/lib/notes";
import type { BookmarkMap } from "@/lib/bookmarks";
import type { CaseMetadata } from "@/lib/cases/types";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import { tokenizeSearchQuery } from "./tokenizer";
import type { SearchIndexCounts, SearchResult } from "./types";

export interface IndexedEntry {
  result: SearchResult;
  /** Deduplicated token set for this entry — a `Set` (not an array) so
   * `searchEngine.ts`'s per-token membership check is O(1) instead of an
   * `Array.prototype.includes` scan. */
  tokens: Set<string>;
  /** Parsed timestamp (ms since epoch), or `null` when this entry has no
   * meaningful one (e.g. a case-wide note) — used for the "boost recent
   * events slightly" ranking rule. */
  timestampMs: number | null;
}

export interface SearchIndex {
  entries: IndexedEntry[];
  /** Windows Event ID (numeric, e.g. 4624) -> every entry citing it
   * (events, IOC findings whose source event has that id, bookmarks of
   * that event) — O(1) lookup for the "exact Event ID" +100 ranking rule
   * and for `eventid:` advanced-query filtering. */
  byEventId: Map<number, IndexedEntry[]>;
  /** MITRE technique ID (uppercase, e.g. "T1059.001") -> every entry citing
   * it — O(1) lookup for the "exact MITRE technique ID" +100 ranking rule
   * and `technique:` advanced-query filtering. */
  byTechniqueId: Map<string, IndexedEntry[]>;
  /** Inverted index: token -> every entry whose tokenized fields include
   * it. This is the structure that keeps a query from ever needing to
   * `.filter()` every entry — `searchEngine.ts` looks each query token up
   * here directly. */
  byToken: Map<string, IndexedEntry[]>;
  /** The latest (`timestampMs`) of every timestamped entry, or `null` if
   * none had one — precomputed here (a running max as entries are added,
   * O(1) amortized) rather than re-scanned per search, so `ranking.ts`'s
   * recency boost can compare against "most recent event *in this case*"
   * without a second full pass over the index at query time. */
  latestTimestampMs: number | null;
  /** `EvtxEvent.id`s currently bookmarked — powers the `bookmarkedOnly`
   * filter and `bookmark:true` advanced-query operator in O(1) per entry,
   * without `searchEngine.ts` needing its own copy of `BookmarkMap`. */
  bookmarkedEventIds: Set<string>;
  /** `EvtxEvent.id`s with at least one non-empty event note — powers the
   * `notesOnly` filter and `notes:true` operator the same way. A `note`
   * result whose `sourceEventId` is absent (the one case-wide note) is
   * handled separately in `searchEngine.ts`, since it has no event to be
   * "about". */
  notedEventIds: Set<string>;
  builtAt: number;
  counts: SearchIndexCounts;
}

export interface BuildSearchIndexInput {
  events: readonly EvtxEvent[];
  iocFindings: readonly DetectionFinding[];
  caseNote: CaseNote | null;
  eventNotes: EventNoteMap;
  bookmarks: BookmarkMap;
  savedCases: readonly CaseMetadata[];
}

function tokenSetOf(...fields: Array<string | number | undefined | null>): Set<string> {
  const tokens = new Set<string>();
  for (const field of fields) {
    if (field === undefined || field === null || field === "") continue;
    for (const token of tokenizeSearchQuery(String(field))) tokens.add(token);
  }
  return tokens;
}

function parseTimestampMs(timestamp: string | undefined | null): number | null {
  if (!timestamp) return null;
  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

class IndexBuilder {
  entries: IndexedEntry[] = [];
  byEventId = new Map<number, IndexedEntry[]>();
  byTechniqueId = new Map<string, IndexedEntry[]>();
  byToken = new Map<string, IndexedEntry[]>();
  latestTimestampMs: number | null = null;

  add(result: SearchResult, tokens: Set<string>, timestampMs: number | null): void {
    const entry: IndexedEntry = { result, tokens, timestampMs };
    this.entries.push(entry);

    if (timestampMs !== null && (this.latestTimestampMs === null || timestampMs > this.latestTimestampMs)) {
      this.latestTimestampMs = timestampMs;
    }

    if (result.eventId !== undefined) {
      const bucket = this.byEventId.get(result.eventId);
      if (bucket) bucket.push(entry);
      else this.byEventId.set(result.eventId, [entry]);
    }

    if (result.techniqueId) {
      const key = result.techniqueId.toUpperCase();
      const bucket = this.byTechniqueId.get(key);
      if (bucket) bucket.push(entry);
      else this.byTechniqueId.set(key, [entry]);
    }

    for (const token of tokens) {
      const bucket = this.byToken.get(token);
      if (bucket) bucket.push(entry);
      else this.byToken.set(token, [entry]);
    }
  }
}

/**
 * Builds every event's `IndexedEntry`, and returns the `EvtxEvent.id ->
 * EvtxEvent` map the caller below reuses for IOC/note/bookmark entries'
 * event cross-references — a second full scan of every finding/note/
 * bookmark would otherwise need its own O(events) lookup pass just to
 * resolve "which event is this about", so this map is built once, here,
 * during the one pass this function already makes over `events`.
 */
function indexEvents(builder: IndexBuilder, events: readonly EvtxEvent[]): Map<string, EvtxEvent> {
  const byId = new Map<string, EvtxEvent>();

  for (const event of events) {
    byId.set(event.id, event);

    const result: SearchResult = {
      id: `event:${event.id}`,
      type: "event",
      title: `Event ${event.eventId}`,
      subtitle: `${event.provider || "Unknown provider"} • ${event.computer || "Unknown host"}`,
      description: event.message || "",
      score: 0,
      matchedFields: [],
      eventId: event.eventId,
      sourceEventId: event.id,
      provider: event.provider || undefined,
      computer: event.computer || undefined,
      level: event.level,
      timestamp: event.timestamp,
      route: "/dashboard",
      metadata: { focusEventId: event.id },
    };

    const tokens = tokenSetOf(
      event.eventId,
      event.provider,
      event.computer,
      event.channel,
      event.level,
      event.message,
      event.user,
    );

    builder.add(result, tokens, parseTimestampMs(event.timestamp));
  }

  return byId;
}

function indexIocFindings(
  builder: IndexBuilder,
  findings: readonly DetectionFinding[],
  eventById: ReadonlyMap<string, EvtxEvent>,
): void {
  for (const finding of findings) {
    const sourceEvent = eventById.get(finding.eventId);

    const result: SearchResult = {
      id: `ioc:${finding.id}`,
      type: "ioc",
      title: finding.title,
      subtitle: finding.ruleName,
      description: finding.description,
      score: 0,
      matchedFields: [],
      eventId: sourceEvent?.eventId,
      sourceEventId: finding.eventId,
      provider: sourceEvent?.provider,
      computer: sourceEvent?.computer,
      techniqueId: finding.mitreTechnique,
      severity: finding.severity,
      // Phase 5.13 — Detection Engine 2.0. Passed through as-is (undefined
      // for a finding the context-aware engine didn't enrich) — powers the
      // `confidence:`/`risk:` advanced-query operators in `searchEngine.ts`.
      confidence: finding.confidence,
      confidenceLevel: finding.confidenceLevel,
      riskScore: finding.riskScore,
      timestamp: sourceEvent?.timestamp,
      route: "/dashboard",
      metadata: { focusEventId: finding.eventId },
    };

    const tokens = tokenSetOf(
      finding.ruleId,
      finding.ruleName,
      finding.title,
      finding.description,
      finding.recommendation,
      finding.severity,
      finding.mitreTechnique,
      sourceEvent?.eventId,
    );

    builder.add(result, tokens, parseTimestampMs(sourceEvent?.timestamp));
  }
}

function indexMitreTechniques(builder: IndexBuilder, iocFindings: readonly DetectionFinding[]): void {
  // Reused, not re-implemented — the same aggregation every MITRE-aware
  // page in this app already calls from `iocFindings`.
  const aggregation = aggregateMitreFindings(iocFindings);

  for (const technique of aggregation.techniques) {
    const result: SearchResult = {
      id: `mitre:${technique.id}`,
      type: "mitre",
      title: `${technique.id} — ${technique.name}`,
      subtitle: technique.tactic,
      description: technique.description,
      score: 0,
      matchedFields: [],
      techniqueId: technique.id,
      tactic: technique.tactic,
      severity: technique.highestSeverity ?? undefined,
      route: "/dashboard/mitre",
      metadata: { focusTechniqueId: technique.id },
    };

    const tokens = tokenSetOf(
      technique.id,
      technique.name,
      technique.tactic,
      technique.description,
      technique.recommendation,
    );

    builder.add(result, tokens, null);
  }
}

function indexNotes(
  builder: IndexBuilder,
  caseNote: CaseNote | null,
  eventNotes: EventNoteMap,
  eventById: ReadonlyMap<string, EvtxEvent>,
): void {
  if (caseNote && caseNote.text.trim().length > 0) {
    const result: SearchResult = {
      id: "note:case",
      type: "note",
      title: "Case Note",
      subtitle: "Investigator note for this case",
      description: caseNote.text,
      score: 0,
      matchedFields: [],
      timestamp: caseNote.updatedAt,
      route: "/dashboard",
    };
    builder.add(result, tokenSetOf(caseNote.text), parseTimestampMs(caseNote.updatedAt));
  }

  for (const [eventId, note] of Object.entries(eventNotes)) {
    if (note.text.trim().length === 0) continue;
    const sourceEvent = eventById.get(eventId);

    const result: SearchResult = {
      id: `note:event:${eventId}`,
      type: "note",
      title: sourceEvent ? `Note on Event ${sourceEvent.eventId}` : "Note on an event",
      subtitle: sourceEvent ? `${sourceEvent.provider || "Unknown provider"} • ${sourceEvent.computer || "Unknown host"}` : "Event not in the currently loaded dataset",
      description: note.text,
      score: 0,
      matchedFields: [],
      eventId: sourceEvent?.eventId,
      sourceEventId: eventId,
      provider: sourceEvent?.provider,
      computer: sourceEvent?.computer,
      timestamp: note.updatedAt,
      route: "/dashboard",
      metadata: { focusEventId: eventId },
    };

    const tokens = tokenSetOf(note.text, sourceEvent?.eventId, sourceEvent?.provider, sourceEvent?.computer);
    builder.add(result, tokens, parseTimestampMs(note.updatedAt));
  }
}

function indexBookmarks(
  builder: IndexBuilder,
  bookmarks: BookmarkMap,
  eventById: ReadonlyMap<string, EvtxEvent>,
): void {
  for (const eventId of Object.keys(bookmarks)) {
    const sourceEvent = eventById.get(eventId);

    const result: SearchResult = {
      id: `bookmark:${eventId}`,
      type: "bookmark",
      title: sourceEvent ? `Bookmarked: Event ${sourceEvent.eventId}` : "Bookmarked event",
      subtitle: sourceEvent ? `${sourceEvent.provider || "Unknown provider"} • ${sourceEvent.computer || "Unknown host"}` : "Event not in the currently loaded dataset",
      description: sourceEvent?.message ?? "",
      score: 0,
      matchedFields: [],
      eventId: sourceEvent?.eventId,
      sourceEventId: eventId,
      provider: sourceEvent?.provider,
      computer: sourceEvent?.computer,
      timestamp: sourceEvent?.timestamp,
      route: "/dashboard",
      metadata: { focusEventId: eventId },
    };

    const tokens = tokenSetOf(sourceEvent?.eventId, sourceEvent?.provider, sourceEvent?.computer, sourceEvent?.message);
    builder.add(result, tokens, parseTimestampMs(sourceEvent?.timestamp));
  }
}

function indexCases(builder: IndexBuilder, savedCases: readonly CaseMetadata[]): void {
  for (const savedCase of savedCases) {
    const result: SearchResult = {
      id: `case:${savedCase.id}`,
      type: "case",
      title: savedCase.name,
      subtitle: `${savedCase.eventCount.toLocaleString()} events • ${savedCase.sourceFiles.length} source file${savedCase.sourceFiles.length === 1 ? "" : "s"}`,
      description: savedCase.sourceFiles.join(", "),
      score: 0,
      matchedFields: [],
      threatLevel: savedCase.threatLevel,
      timestamp: savedCase.lastOpened,
      route: "/dashboard/cases",
    };

    const tokens = tokenSetOf(savedCase.name, savedCase.id, ...savedCase.sourceFiles);
    builder.add(result, tokens, parseTimestampMs(savedCase.lastOpened));
  }
}

/** Builds a fresh `SearchIndex` from already-loaded investigation data.
 * Never throws: every source array/map may be empty, and every optional
 * field (provider/computer/message/mitreTechnique/etc.) may be missing —
 * every indexing function above degrades to blank strings/omitted fields
 * rather than crashing, the same "never throw on missing/empty data"
 * contract every other `lib/*` module in this project follows. */
export function buildSearchIndex(input: BuildSearchIndexInput): SearchIndex {
  const builder = new IndexBuilder();

  const eventById = indexEvents(builder, input.events);
  indexIocFindings(builder, input.iocFindings, eventById);
  indexMitreTechniques(builder, input.iocFindings);
  indexNotes(builder, input.caseNote, input.eventNotes, eventById);
  indexBookmarks(builder, input.bookmarks, eventById);
  indexCases(builder, input.savedCases);

  const counts: SearchIndexCounts = {
    events: input.events.length,
    iocs: input.iocFindings.length,
    mitre: builder.entries.filter((entry) => entry.result.type === "mitre").length,
    notes: builder.entries.filter((entry) => entry.result.type === "note").length,
    bookmarks: Object.keys(input.bookmarks).length,
    cases: input.savedCases.length,
  };

  return {
    entries: builder.entries,
    byEventId: builder.byEventId,
    byTechniqueId: builder.byTechniqueId,
    byToken: builder.byToken,
    latestTimestampMs: builder.latestTimestampMs,
    bookmarkedEventIds: new Set(Object.keys(input.bookmarks)),
    notedEventIds: new Set(Object.keys(input.eventNotes).filter((id) => input.eventNotes[id].text.trim().length > 0)),
    builtAt: Date.now(),
    counts,
  };
}
