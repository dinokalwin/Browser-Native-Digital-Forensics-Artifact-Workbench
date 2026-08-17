/**
 * Detection Engine 2.0 — service installation context (Phase 5.13).
 *
 * Pure, framework-free. The Service Installation rule
 * (`rules/serviceInstallation.ts`) itself is untouched — it still fires on
 * every 7045/4697 event exactly as before (ticket: "MUST continue
 * detecting service creation"). This module is what turns that same event
 * into evidence: it parses the structured fields Windows already logs for
 * a service-install event out of `EvtxEvent.message`, then classifies the
 * image path and checks for a known-vendor/unusual-name signal.
 *
 * `EvtxEvent.message` is never free text for these events — it's built by
 * the protected `record-mapper.ts#buildFallbackMessage`, which renders
 * EventData as `"Name1: Value1 | Name2: Value2 | ..."` in document order,
 * for every event type. `parseEventDataMessage` below inverts that exact
 * format; it's kept here (rather than in `utils.ts`) because service
 * events are its primary consumer, but it's exported for reuse by
 * `contextScoring.ts` when pulling process-creation fields.
 */
import { classifyPath, type PathClassificationResult } from "./pathContext";
import { looksLikeRandomIdentifier, matchKnownVendor, type VendorMatch } from "./vendorContext";

/**
 * Inverts `buildFallbackMessage`'s `"Name: Value | Name: Value | ..."`
 * format. Splits on the pipe delimiter first, then each part on the FIRST
 * `": "` — safe because the message was built by joining `${name}: ${value}`
 * pairs with `" | "`, so a value that itself contains ": " (e.g. a
 * timestamp or a URL) still splits correctly as long as it doesn't also
 * contain the literal " | " sequence, which EventData values essentially
 * never do in practice. Never throws: a message with no recognizable
 * "Name: Value" shape just yields an empty map.
 */
export function parseEventDataMessage(message: string | null | undefined): Map<string, string> {
  const fields = new Map<string, string>();
  if (!message) return fields;

  for (const part of message.split(" | ")) {
    const separatorIndex = part.indexOf(": ");
    if (separatorIndex === -1) continue;
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 2).trim();
    if (name.length === 0) continue;
    fields.set(name, value);
  }
  return fields;
}

/** Reads the first present field name from `candidates`, or `null`. */
function firstField(fields: Map<string, string>, candidates: readonly string[]): string | null {
  for (const name of candidates) {
    const value = fields.get(name);
    if (value) return value;
  }
  return null;
}

export type ServiceAccountClass = "system" | "network-service" | "local-service" | "user" | "unknown";

const SYSTEM_ACCOUNT_PATTERN = /^(nt authority\\)?system$|^localsystem$/i;
const NETWORK_SERVICE_PATTERN = /^(nt authority\\)?network ?service$/i;
const LOCAL_SERVICE_PATTERN = /^(nt authority\\)?local ?service$/i;

/**
 * Buckets a raw account string into the handful of classes that matter for
 * risk scoring — running as SYSTEM is the strongest of the three built-in
 * service accounts (full privilege), Network/Local Service are lower-
 * privilege built-ins, and anything shaped like `DOMAIN\user` is a real
 * user account (unusual, though not inherently malicious, for a service).
 */
export function classifyServiceAccount(account: string | null | undefined): ServiceAccountClass {
  if (!account) return "unknown";
  const trimmed = account.trim();
  if (SYSTEM_ACCOUNT_PATTERN.test(trimmed)) return "system";
  if (NETWORK_SERVICE_PATTERN.test(trimmed)) return "network-service";
  if (LOCAL_SERVICE_PATTERN.test(trimmed)) return "local-service";
  if (trimmed.length > 0) return "user";
  return "unknown";
}

export interface ServiceContext {
  serviceName: string | null;
  displayName: string | null;
  /** ImagePath (7045) or ServiceFileName (4697) — whichever the event
   * actually logged. */
  imagePath: string | null;
  account: string | null;
  accountClass: ServiceAccountClass;
  startType: string | null;
  serviceType: string | null;
  pathClassification: PathClassificationResult;
  vendorMatch: VendorMatch;
  /** True when the service name looks machine-generated rather than a
   * normal human-chosen product/service name — see
   * `vendorContext.ts#looksLikeRandomIdentifier`. */
  unusualName: boolean;
}

const EMPTY_PATH_CLASSIFICATION: PathClassificationResult = { classification: "unknown", matchedSegment: null };

/**
 * Extracts and classifies everything available about one service-install
 * event's message. Never throws — an event whose message doesn't parse
 * into any recognizable field (should be rare for 7045/4697, but not
 * assumed) still returns a fully-populated `ServiceContext` with every
 * field `null`/`"unknown"` rather than crashing `contextScoring.ts`'s
 * enrichment pass.
 */
export function analyzeServiceContext(message: string | null | undefined): ServiceContext {
  const fields = parseEventDataMessage(message);

  const serviceName = firstField(fields, ["ServiceName"]);
  const displayName = firstField(fields, ["DisplayName", "ServiceDisplayName"]);
  const imagePath = firstField(fields, ["ImagePath", "ServiceFileName", "ImageName"]);
  const account = firstField(fields, ["AccountName", "ServiceAccount", "ServiceStartName"]);
  const startType = firstField(fields, ["StartType", "ServiceStartType"]);
  const serviceType = firstField(fields, ["ServiceType"]);
  const pathClassification = imagePath ? classifyPath(imagePath) : EMPTY_PATH_CLASSIFICATION;
  const vendorMatch = matchKnownVendor([
    { text: serviceName, source: "service-name" },
    { text: displayName, source: "display-name" },
    { text: imagePath, source: "image-path" },
  ]);

return {
  serviceName,
  displayName,
  imagePath,
  account,
  accountClass: classifyServiceAccount(account),
  startType,
  serviceType,
  pathClassification,
  vendorMatch,
  unusualName: looksLikeRandomIdentifier(serviceName ?? displayName),
  };
}
