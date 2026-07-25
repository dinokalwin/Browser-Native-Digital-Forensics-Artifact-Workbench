/**
 * Maps one decoded EVTX record's rendered XML into the frontend's
 * `EvtxEvent` shape (src/types/evidence.ts).
 *
 * Ported from Member 2's Core Logic module's record-mapper.ts, adapted to
 * this project's type contract (EvtxEvent has `user` instead of a
 * structured `eventData` map, and `raw` is an opaque unknown for
 * drill-down rather than a typed field).
 *
 * Security note: DOMParser output here is never attached to the live DOM
 * and never rendered via innerHTML — only .textContent/attribute reads.
 * Browser DOMParser does not resolve external entities for text/xml
 * content, so this is not an XXE vector despite the source bytes being
 * attacker-controllable (a user-supplied forensic artifact).
 */
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

let cachedXmlParser: DOMParser | null = null;
function getXmlParser(): DOMParser {
  if (!cachedXmlParser) cachedXmlParser = new DOMParser();
  return cachedXmlParser;
}

function textOf(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? "";
}

function firstByTag(scope: Document | Element, tag: string): Element | null {
  const els = scope.getElementsByTagName(tag);
  return els.length > 0 ? els[0] : null;
}

/**
 * Reconstructs a human-readable summary from EventData/UserData fields
 * when no message catalog is available — mirrors Event Viewer's own
 * fallback ("the following information is part of the event: ...").
 */
function buildFallbackMessage(dataScope: Element | null): string {
  if (!dataScope) return "(No event data available.)";
  const dataEls = Array.from(dataScope.getElementsByTagName("Data"));
  if (dataEls.length === 0) return "(No event data available.)";

  const parts = dataEls
    .map((el) => {
      const name = el.getAttribute("Name");
      const value = el.textContent?.trim() ?? "";
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
  const xml = record.renderXml();
  const doc = getXmlParser().parseFromString(xml, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror");
  if (parserError.length > 0) {
    if (debugLogCount < MAX_DEBUG_LOGS) {
      debugLogCount++;
      // eslint-disable-next-line no-console
      console.error("[EVTX DEBUG] XML parse failed. Raw XML:", xml);
      // eslint-disable-next-line no-console
      console.error("[EVTX DEBUG] Parser error:", parserError[0].textContent);
    }
    return null;
  }

  const system = firstByTag(doc, "System");
  if (!system) {
    if (debugLogCount < MAX_DEBUG_LOGS) {
      debugLogCount++;
      // eslint-disable-next-line no-console
      console.error("[EVTX DEBUG] No <System> element found. Raw XML:", xml);
    }
    return null;
  }

  const provider = firstByTag(system, "Provider");
  const levelNum = Number(textOf(firstByTag(system, "Level")));
  const level: EventLevel = LEVEL_MAP[levelNum] ?? "Information";

  const timeCreated = firstByTag(system, "TimeCreated");
  const timeCreatedRaw = timeCreated?.getAttribute("SystemTime") ?? null;
  const timestamp = safeTimestamp(record, timeCreatedRaw);

  const security = firstByTag(system, "Security");
  const dataScope = doc.getElementsByTagName("EventData")[0] ?? doc.getElementsByTagName("UserData")[0] ?? null;

  let user = security?.getAttribute("UserID") ?? "N/A";
  if (dataScope) {
    const named = Array.from(dataScope.getElementsByTagName("Data")).find((el) =>
      USER_FRIENDLY_FIELDS.includes(el.getAttribute("Name") ?? ""),
    );
    if (named?.textContent?.trim()) user = named.textContent.trim();
  }

  return {
    id: `evt-${record.recordNum().toString()}`,
    timestamp,
    eventId: Number(textOf(firstByTag(system, "EventID"))) || 0,
    provider: provider?.getAttribute("Name") ?? "Unknown",
    computer: textOf(firstByTag(system, "Computer")) || "Unknown",
    user,
    level,
    channel: textOf(firstByTag(system, "Channel")) || "Unknown",
    message: buildFallbackMessage(dataScope),
    raw: { xml },
  };
}
