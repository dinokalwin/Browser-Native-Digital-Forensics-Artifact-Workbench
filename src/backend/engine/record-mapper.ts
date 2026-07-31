/**
 * Maps one decoded EVTX record's rendered XML into the frontend's
 * `EvtxEvent` shape (src/types/evidence.ts).
 *
 * Ported from Member 2's Core Logic module's record-mapper.ts, adapted to
 * this project's type contract (EvtxEvent has `user` instead of a
 * structured `eventData` map, and `raw` is an opaque unknown for
 * drill-down rather than a typed field).
 *
 * XML engine: fast-xml-parser, not DOMParser.
 *
 * This file runs inside a dedicated Web Worker (see
 * src/backend/engine/parser.worker.ts). `DOMParser` is a `[Exposed=Window]`
 * Web IDL interface — it is not exposed to any Worker global scope in any
 * browser, by spec, regardless of bundler or worker type. Calling
 * `new DOMParser()` here throws `ReferenceError: DOMParser is not defined`
 * for every single record, which is why the previous DOMParser-based
 * version of this file parsed zero events once parsing moved off the main
 * thread. `fast-xml-parser` is pure JavaScript with no DOM dependency, so
 * it works identically on the main thread, in a Worker, or in Node.
 *
 * Behavioral parity with the previous DOMParser-based implementation was
 * verified by cross-running both implementations against the same set of
 * representative EVTX record XML shapes (multi-field EventData, single-
 * field EventData, no EventData, UserData instead of EventData, and
 * XML-escaped special characters in a PowerShell script block) and
 * confirming byte-identical output for every field on every case,
 * including the "first friendly field in *document order*, not list
 * order" quirk of the original user-resolution logic. See
 * docs/ARCHITECTURE_DECISIONS.md for the full write-up.
 *
 * Security note: neither implementation resolves external entities for
 * XML content, so this remains XXE-safe despite the source bytes being
 * attacker-controllable (a user-supplied forensic artifact). Output is
 * never rendered via innerHTML — only plain string/attribute reads.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";

import type { EventLevel, EvtxEvent } from "@/types/evidence";

// Deep-imported record type only for typing `renderXml()`'s caller —
// avoided at runtime via `unknown`-typed parameter to keep this module
// free of a hard dependency on @ts-evtx/core's internal Record class
// shape beyond the two methods it actually calls.
interface EvtxRecordLike {
  recordNum(): bigint;
  renderXml(): string;
  timestampAsDate(): Date;
}

const LEVEL_MAP: Record<number, EventLevel> = {
  0: "Information", // LogAlways
  1: "Critical",
  2: "Error",
  3: "Warning",
  4: "Information",
  5: "Verbose",
};

const USER_FRIENDLY_FIELDS = ["TargetUserName", "SubjectUserName", "AccountName", "UserName"];

/**
 * A parsed XML element, as produced by fast-xml-parser with this file's
 * options: attributes under `@_<Name>` keys, text content under `#text`
 * (only present when the element also has attributes or siblings —
 * otherwise the element's value collapses to a plain string), and child
 * elements under their own tag-name keys (an array only when `isArray`
 * says so — see `getXmlParser` below).
 */
type XmlNode = Record<string, unknown>;

let cachedXmlParser: XMLParser | null = null;
function getXmlParser(): XMLParser {
  if (!cachedXmlParser) {
    cachedXmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      // Keep values as plain strings rather than auto-coercing to
      // number/boolean: this project's own code explicitly Number()s the
      // two fields that need it (EventID, Level), and auto-coercion
      // elsewhere risks silently reinterpreting forensic string data
      // (e.g. a numeric-looking account name).
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
      // EventData/UserData can legitimately contain zero, one, or many
      // <Data> children. Without this, a single <Data> child parses as a
      // bare object instead of a one-element array, which would silently
      // break buildFallbackMessage's .map() below for the (common)
      // single-field case.
      isArray: (name) => name === "Data",
    });
  }
  return cachedXmlParser;
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (typeof node === "object") {
    const text = (node as XmlNode)["#text"];
    if (typeof text === "string") return text.trim();
    if (typeof text === "number") return String(text);
  }
  return "";
}

function attrOf(node: unknown, attr: string): string | null {
  if (node == null || typeof node !== "object") return null;
  const val = (node as XmlNode)[`@_${attr}`];
  return val == null ? null : String(val);
}

/**
 * Depth-first search for the first descendant tagged `tag`, anywhere in
 * the subtree — mirrors DOMParser + `getElementsByTagName`'s whole-subtree
 * lookup semantics (rather than hardcoding exact nesting), so this stays
 * exactly as resilient to schema variation as the code it replaces.
 */
function findFirstByTag(node: unknown, tag: string): XmlNode | undefined {
  if (node == null || typeof node !== "object") return undefined;
  const obj = node as XmlNode;
  if (tag in obj) {
    const val = obj[tag];
    const first = Array.isArray(val) ? val[0] : val;
    return (first ?? undefined) as XmlNode | undefined;
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith("@_") || key === "#text") continue;
    const found = findFirstByTag(obj[key], tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

function dataElementsOf(scope: XmlNode | undefined): unknown[] {
  if (!scope) return [];
  const raw = scope["Data"];
  return Array.isArray(raw) ? raw : raw != null ? [raw] : [];
}

/**
 * Reconstructs a human-readable summary from EventData/UserData fields
 * when no message catalog is available — mirrors Event Viewer's own
 * fallback ("the following information is part of the event: ...").
 */
function buildFallbackMessage(dataScope: XmlNode | undefined): string {
  if (!dataScope) return "(No event data available.)";
  const dataEls = dataElementsOf(dataScope);
  if (dataEls.length === 0) return "(No event data available.)";

  const parts = dataEls
    .map((el) => {
      const name = attrOf(el, "Name");
      const value = textOf(el);
      if (!value) return null;
      return name ? `${name}: ${value}` : value;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" | ") : "(No event data available.)";
}

/**
 * record.timestampAsDate() can throw or yield an Invalid Date for corrupt
 * FILETIME values in a dirty/partially-overwritten chunk. Deliberately
 * does NOT fall back to a fabricated date (e.g. the Unix epoch): a
 * forensics tool that silently substituted a plausible-looking fake
 * timestamp would let a corrupt-timestamp event masquerade as a real
 * 1970 event, corrupting timeline analysis in a way that's invisible to
 * the analyst. Falls back to the XML's raw SystemTime attribute string
 * (still evidence, just unparsed) or, failing that, an explicit sentinel
 * that is never confused with a real date.
 */
function safeTimestamp(record: EvtxRecordLike, timeCreatedRaw: string | null): string {
  try {
    const date = record.timestampAsDate();
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  } catch {
    // fall through to the XML-attribute fallback below
  }
  return timeCreatedRaw ?? "";
}

let debugLogCount = 0;
const MAX_DEBUG_LOGS = 3;

export function xmlToEvent(record: EvtxRecordLike): EvtxEvent | null {
  let xml: string;
  try {
    xml = record.renderXml();
  } catch (err) {
    if (debugLogCount < MAX_DEBUG_LOGS) {
      debugLogCount++;
       
      console.error("[EVTX DEBUG] renderXml() failed:", err);
    }
    return null;
  }

  // XMLValidator is deprecated in fast-xml-parser v5 in favor of the
  // separate `fast-xml-validator` package, but it is still shipped and
  // functional. Kept rather than adding a second dependency for this one
  // call; revisit if a future major version removes it. This is what
  // replaces the old `<parsererror>` element check — both catch the same
  // class of problem (a BXML template/substitution bug in the upstream
  // parser producing invalid XML for a given record).
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    if (debugLogCount < MAX_DEBUG_LOGS) {
      debugLogCount++;
       
      console.error("[EVTX DEBUG] XML parse failed. Raw XML:", xml);
       
      console.error("[EVTX DEBUG] Parser error:", validation.err);
    }
    return null;
  }

  const root = getXmlParser().parse(xml) as XmlNode;
  const system = findFirstByTag(root, "System");
  if (!system) {
    if (debugLogCount < MAX_DEBUG_LOGS) {
      debugLogCount++;
       
      console.error("[EVTX DEBUG] No <System> element found. Raw XML:", xml);
    }
    return null;
  }

  const provider = findFirstByTag(system, "Provider");
  const levelNum = Number(textOf(findFirstByTag(system, "Level")));
  const level: EventLevel = LEVEL_MAP[levelNum] ?? "Information";

  const timeCreated = findFirstByTag(system, "TimeCreated");
  const timeCreatedRaw = attrOf(timeCreated, "SystemTime");
  const timestamp = safeTimestamp(record, timeCreatedRaw);

  const security = findFirstByTag(system, "Security");
  const dataScope = findFirstByTag(root, "EventData") ?? findFirstByTag(root, "UserData");

  let user = attrOf(security, "UserID") ?? "N/A";
  if (dataScope) {
    // First Data element in *document order* whose Name is any of
    // USER_FRIENDLY_FIELDS — not priority-ordered by that list. This
    // matches the original DOMParser-based `.find()` over
    // `getElementsByTagName("Data")` exactly; verified by cross-running
    // both implementations against real-shaped 4624/4625 event XML.
    const named = dataElementsOf(dataScope).find((el) =>
      USER_FRIENDLY_FIELDS.includes(attrOf(el, "Name") ?? ""),
    );
    const namedText = textOf(named);
    if (namedText) user = namedText;
  }

  return {
    id: `evt-${record.recordNum().toString()}`,
    timestamp,
    eventId: Number(textOf(findFirstByTag(system, "EventID"))) || 0,
    provider: attrOf(provider, "Name") ?? "Unknown",
    computer: textOf(findFirstByTag(system, "Computer")) || "Unknown",
    user,
    level,
    channel: textOf(findFirstByTag(system, "Channel")) || "Unknown",
    message: buildFallbackMessage(dataScope),
    raw: { xml },
  };
}
