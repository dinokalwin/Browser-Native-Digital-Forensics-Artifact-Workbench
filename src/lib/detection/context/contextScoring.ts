/**
 * Detection Engine 2.0 — confidence model & enrichment orchestrator
 * (Phase 5.13).
 *
 * Pure, framework-free. This is the ONE place a raw rule finding turns
 * into an explainable, context-aware finding — see `enrichFindings()`,
 * the sole entry point `engine.ts` calls. Nothing in `rules/*.ts` changes:
 * every rule still fires on exactly the same events, at exactly the same
 * base severity, as before this phase (ticket: "DO NOT DELETE OR DISABLE
 * THE EXISTING 14 RULES"). This module only ADDS `confidence`/
 * `confidenceLevel`/`riskScore`/`evidenceSignals`/`context` on top.
 *
 * Performance contract (ticket section 8/26): every shared index below
 * (`buildCorrelationIndex`, per-computer finding groups) is built exactly
 * ONCE per `enrichFindings` call, from `ctx.chronological` (already
 * computed once by `engine.ts#buildContext`) — never re-scanning the full
 * event array per finding. Per-finding lookups use binary search
 * (`lowerBound`) into an already-sorted per-computer bucket, so a single
 * finding's temporal/correlation checks cost O(log n + k) (k = events
 * actually in the time window), not O(n).
 */
import type { DetectionContext, DetectionFinding } from "../types";
import { parseTime } from "../utils";
import type { EvtxEvent } from "@/types/evidence";
import {
  classifyPath,
  extractExecutablePath,
  PATH_CLASSIFICATION_MEANING,
  type PathClassification,
  type PathClassificationResult,
} from "./pathContext";
import { matchKnownVendor, type VendorMatch } from "./vendorContext";
import { analyzeProcessText, type LolbinName } from "./processContext";
import {
  analyzeServiceContext,
  classifyServiceAccount,
  type ServiceAccountClass,
  type ServiceContext,
} from "./serviceContext";

// ---------------------------------------------------------------------------
// Public types (ticket section 2 / 10 / 11)
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "low" | "medium" | "high" | "critical";

/** Ticket section 11's suggested thresholds, used as-is: they were
 * validated against every synthetic scenario in this phase's test suite
 * (`__tests__`/the runtime harness — see the phase's final report) and
 * produced the expected bucket for each one, so no adjustment was needed. */
const CONFIDENCE_LEVEL_THRESHOLDS: Array<{ min: number; level: ConfidenceLevel }> = [
  { min: 75, level: "critical" },
  { min: 50, level: "high" },
  { min: 25, level: "medium" },
  { min: 0, level: "low" },
];

export function confidenceLevelFor(score: number): ConfidenceLevel {
  const clamped = Math.max(0, Math.min(100, score));
  return CONFIDENCE_LEVEL_THRESHOLDS.find((t) => clamped >= t.min)?.level ?? "low";
}

/** One explainable piece of evidence that moved a finding's confidence up
 * or down — exact shape from ticket section 2's worked example. */
export interface EvidenceSignal {
  type: string;
  label: string;
  description: string;
  weight: number;
  severity: "positive" | "negative";
}

/** Compact, display-ready summary of the context this finding was
 * evaluated with — what `EventDetailsDrawer`'s "Why was this detected?"
 * section and the IOC panel's context line read from, without needing to
 * re-derive anything from `evidenceSignals`. */
export interface DetectionContextSummary {
  pathClassification: PathClassification | null;
  pathClassificationMeaning: string | null;
  accountClass: ServiceAccountClass | null;
  vendorMatch: string | null;
  lolbin: LolbinName | null;
  hasEncodedCommand: boolean;
  /** Count of OTHER findings on the same computer within the correlation
   * window (`CORRELATION_WINDOW_MINUTES`) — 0 when this finding is
   * isolated. */
  correlatedFindingCount: number;
}

// ---------------------------------------------------------------------------
// Confidence model (ticket section 10) — documented rationale per weight.
// ---------------------------------------------------------------------------

/** Base rule risk by the rule's own (unmodified) severity — ticket's
 * suggested "20-60" range, anchored so the three existing severities stay
 * ordered the same way they always have, leaving 40-65 points of headroom
 * for context to move a finding down into "low" or up into "critical". */
const BASE_RISK_BY_SEVERITY: Record<DetectionFinding["severity"], number> = {
  critical: 55,
  warning: 35,
  informational: 20,
};

/** Every weight below is ticket section 10's own suggested starting model,
 * used unchanged — validated against this phase's synthetic test suite
 * (A-H) and left as-is since none of those scenarios called for a
 * different number. Documented per-field so a future tuning pass has the
 * rationale, not just the number. */
const RISK_WEIGHTS = {
  /** Image/binary path sits under a core Windows system directory. */
  knownSystemPath: -15,
  /** Image/binary path sits under a standard application-install directory. */
  knownApplicationPath: -10,
  /** Service/display name or path matched a small known-vendor fragment list. */
  expectedVendor: -10,
  /** Service name does NOT look machine-generated (only scored for
   * service-installation findings, where a name is actually expected). */
  expectedServiceNaming: -5,
  /** Path sits under a user-writable profile directory (AppData, Desktop, Public). */
  userWritablePath: 25,
  /** Path sits under a Temp or Downloads directory. */
  temporaryOrDownloadPath: 30,
  /** Command text matched a known obfuscation/suspicious-usage pattern. */
  encodedCommand: 35,
  /** A LOLBin process event was observed immediately before this finding's
   * event, on the same host — a rough proxy for "suspicious parent
   * process" (this project has no real parent-PID linkage available from
   * rendered EVTX message text). */
  suspiciousPrecedingProcess: 25,
  /** Compound signal: running as SYSTEM AND originating from a
   * user-writable/temporary/download path — far more suspicious than
   * either fact alone (a SYSTEM service in Program Files is normal; a
   * SYSTEM service running from Temp is not). */
  systemFromUntrustedPath: 35,
  /** This finding is part of a burst of 3+ suspicious findings on the same
   * host within `CORRELATION_WINDOW_MINUTES`. */
  correlatedActivity: 20,
  /** Service/display name looks machine-generated (see
   * `vendorContext.ts#looksLikeRandomIdentifier`). */
  unusualServiceName: 15,
  kernelModeDriver: 20,
} as const;

const CORRELATION_WINDOW_MINUTES = 15;
const PRECEDING_PROCESS_WINDOW_MINUTES = 2;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Sums `signals`' weights onto `baseRisk` and clamps to 0-100. Exported
 * standalone (not just used internally) so a runtime harness/future rule
 * can compute a confidence score from a hand-built signal list without
 * going through the full `enrichFindings` pipeline. */
export function calculateFindingConfidence(baseRisk: number, signals: readonly EvidenceSignal[]): number {
  const total = signals.reduce((sum, s) => sum + s.weight, 0);
  return clampScore(baseRisk + total);
}

// ---------------------------------------------------------------------------
// Correlation / temporal context (ticket sections 8-9)
// ---------------------------------------------------------------------------

interface CorrelationIndex {
  /** Every event, grouped by computer, each bucket still in the original
   * chronological order (`ctx.chronological` is a stable sort, and this
   * groups it in one pass — so every bucket is already time-ascending
   * without a second sort). */
  eventsByComputer: Map<string, EvtxEvent[]>;
}

function buildCorrelationIndex(ctx: DetectionContext): CorrelationIndex {
  const eventsByComputer = new Map<string, EvtxEvent[]>();
  for (const event of ctx.chronological) {
    const bucket = eventsByComputer.get(event.computer);
    if (bucket) bucket.push(event);
    else eventsByComputer.set(event.computer, [event]);
  }
  return { eventsByComputer };
}

/** First index `i` such that `parseTime(bucket[i]) >= timeMs` — standard
 * binary-search lower bound, requires `bucket` sorted ascending by time
 * (every `eventsByComputer` bucket is, by construction above). */
function lowerBoundByTime(bucket: readonly EvtxEvent[], timeMs: number): number {
  let lo = 0;
  let hi = bucket.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (parseTime(bucket[mid]) < timeMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * `getTemporalContext` — ticket section 9's requested helper shape
 * (before/after/withinMinutes), bound to one computer's pre-sorted event
 * bucket so every query below is a binary search plus a bounded scan of
 * the matched window, never a scan of the full case.
 */
function getTemporalContext(index: CorrelationIndex, computer: string, timestampMs: number) {
  const bucket = index.eventsByComputer.get(computer) ?? [];

  function withinMinutes(minutes: number): EvtxEvent[] {
    const windowMs = minutes * 60_000;
    const start = lowerBoundByTime(bucket, timestampMs - windowMs);
    const end = lowerBoundByTime(bucket, timestampMs + windowMs + 1);
    return bucket.slice(start, end);
  }

  function before(minutes: number): EvtxEvent[] {
    const windowMs = minutes * 60_000;
    const start = lowerBoundByTime(bucket, timestampMs - windowMs);
    const end = lowerBoundByTime(bucket, timestampMs);
    return bucket.slice(start, end);
  }

  function after(minutes: number): EvtxEvent[] {
    const windowMs = minutes * 60_000;
    const start = lowerBoundByTime(bucket, timestampMs + 1);
    const end = lowerBoundByTime(bucket, timestampMs + windowMs + 1);
    return bucket.slice(start, end);
  }

  return { withinMinutes, before, after };
}

// ---------------------------------------------------------------------------
// Per-finding enrichment
// ---------------------------------------------------------------------------

function pushSignal(
  signals: EvidenceSignal[],
  type: string,
  label: string,
  description: string,
  weight: number,
): void {
  signals.push({ type, label, description, weight, severity: weight < 0 ? "positive" : "negative" });
}

function pathSignal(signals: EvidenceSignal[], result: PathClassificationResult, subjectLabel: string): void {
  switch (result.classification) {
    case "trusted-system":
      pushSignal(
        signals,
        "trusted-system-path",
        "Known system directory",
        `${subjectLabel} is located under a core Windows system directory (matched "${result.matchedSegment}").`,
        RISK_WEIGHTS.knownSystemPath,
      );
      return;
    case "trusted-application":
      pushSignal(
        signals,
        "trusted-application-path",
        "Known application directory",
        `${subjectLabel} is located under a standard application-install directory (matched "${result.matchedSegment}").`,
        RISK_WEIGHTS.knownApplicationPath,
      );
      return;
    case "user-writable":
      pushSignal(
        signals,
        "user-writable-path",
        "User-writable path",
        `${subjectLabel} originates from a user-writable profile directory (matched "${result.matchedSegment}").`,
        RISK_WEIGHTS.userWritablePath,
      );
      return;
    case "temporary":
    case "download":
      pushSignal(
        signals,
        result.classification === "temporary" ? "temporary-path" : "download-path",
        result.classification === "temporary" ? "Temporary directory" : "Downloads directory",
        `${subjectLabel} originates from a ${result.classification === "temporary" ? "Temp" : "Downloads"} directory (matched "${result.matchedSegment}") — legitimate installers pass through here but rarely persist.`,
        RISK_WEIGHTS.temporaryOrDownloadPath,
      );
      return;
    case "unknown":
      return; // No signal either way — nothing to explain.
  }
}

function vendorSignal(signals: EvidenceSignal[], vendorMatch: VendorMatch): void {
  if (!vendorMatch.matched || !vendorMatch.vendor) return;
  pushSignal(
    signals,
    "expected-vendor",
    "Known vendor/product name",
    `Matched a known vendor/product name fragment ("${vendorMatch.vendor}") — a weak legitimacy signal, not confirmation.`,
    RISK_WEIGHTS.expectedVendor,
  );
}

function accountPathComboSignal(
  signals: EvidenceSignal[],
  accountClass: ServiceAccountClass,
  pathClassification: PathClassification,
): void {
  if (accountClass !== "system") return;
  if (pathClassification !== "user-writable" && pathClassification !== "temporary" && pathClassification !== "download") return;
  pushSignal(
    signals,
    "system-from-untrusted-path",
    "SYSTEM execution from an untrusted path",
    "Runs as SYSTEM (full local privilege) from a path an ordinary user process can write to — a strong combined indicator.",
    RISK_WEIGHTS.systemFromUntrustedPath,
  );
}

/** Best-effort "account associated with this finding" — service events use
 * the parsed service account; every other event falls back to
 * `EvtxEvent.user` (always populated, see `types/evidence.ts`). */
function resolveAccountText(event: EvtxEvent, serviceAccount: string | null): string {
  return serviceAccount ?? event.user;
}

// ---------------------------------------------------------------------------
// Context-aware correlation adjustment (Phase 5.13.1 — false-positive
// amplification fix).
//
// PROBLEM: the correlation signal below originally awarded +20 to EVERY
// finding once >=2 OTHER findings existed on the same host within
// `CORRELATION_WINDOW_MINUTES`, regardless of what those other findings
// were. A burst of clearly legitimate service installs (e.g. a VPN client
// installing ProtonVPN + Wintun + WireGuard in quick succession) would
// mutually correlate with EACH OTHER and all get bumped +20, even though
// none of them are independently suspicious — pure false-positive
// amplification, not evidence of anything.
//
// FIX: for service-installation findings only, withhold the correlation
// bonus when (a) this finding's own service context already looks strongly
// legitimate (known vendor, trusted path, ordinary name) AND (b) none of
// the nearby findings are themselves independently suspicious. Every other
// finding type, and every service-installation finding that ISN'T strongly
// legitimate, keeps the exact original behavior. This never changes
// `RISK_WEIGHTS.correlatedActivity`, `CORRELATION_WINDOW_MINUTES`, or the
// >=2 threshold — it only decides, given that threshold is already met,
// whether awarding the bonus is actually justified for THIS finding.
// ---------------------------------------------------------------------------

/** Rule IDs whose presence nearby indicates genuinely suspicious activity —
 * not just "some other finding exists nearby". Deliberately excludes
 * baseline-visibility rules that fire on ordinary, non-suspicious activity
 * by design (`powershell` — see its own doc comment; `rdp-logon` — RDP
 * itself is routine) and excludes `service-installation` itself (a nearby
 * *legitimate* service must never count as a "suspicious neighbor" — that
 * would just re-introduce the same amplification bug from the other
 * direction). Matches this phase's ticket enumeration: encoded PowerShell,
 * Defender tampering, audit log clearing, WMI persistence, scheduled
 * tasks, brute force / suspicious login activity. */
const SUSPICIOUS_CORRELATION_RULE_IDS: ReadonlySet<string> = new Set([
  "encoded-powershell",
  "defender-disabled",
  "defender-detection",
  "audit-log-cleared",
  "wmi-persistence",
  "scheduled-task",
  "brute-force",
  "successful-login-after-failures",
]);

/** A service-installation finding's own context is "strongly legitimate"
 * when all three hold: it matched a known vendor/product fragment, its
 * image path sits under a trusted (system or application) directory, and
 * its service name doesn't look machine-generated. Any one of these being
 * false is enough uncertainty that correlation nearby should still count
 * normally — this is intentionally a conjunction, not "any one signal is
 * enough to suppress correlation". */
export function isStronglyLegitimateService(serviceContext: ServiceContext): boolean {
  return (
    serviceContext.vendorMatch.matched &&
    (serviceContext.pathClassification.classification === "trusted-system" ||
      serviceContext.pathClassification.classification === "trusted-application") &&
    !serviceContext.unusualName
  );
}

export interface CorrelationDecision {
  /** Whether `RISK_WEIGHTS.correlatedActivity` should be awarded. */
  apply: boolean;
  /** Raw count of other findings on this host within the correlation
   * window — reported regardless of `apply`, so `DetectionContextSummary.
   * correlatedFindingCount` always reflects reality even when the bonus
   * itself was withheld. */
  count: number;
  /** Human-readable explanation of why the bonus was (or wasn't) applied —
   * used verbatim as the evidence signal's description when `apply` is
   * true. Never left generic/misleading: a caller must not reuse this text
   * for a signal it didn't actually add. */
  reason: string;
}

/**
 * Decides whether a finding should receive the correlated-activity
 * confidence bonus, given the OTHER findings already found nearby (see
 * `correlatedFindingsFor` in `enrichFindings` below — reuses the exact same
 * shared `findingsByComputer` index and binary-search window, no second
 * scan). Pure and independently testable: takes plain data in, returns a
 * plain decision, no lookups of its own.
 *
 * - Fewer than 2 nearby findings: never applies (unchanged threshold).
 * - Non-service findings, and service findings that aren't strongly
 *   legitimate: unchanged original behavior — applies whenever the
 *   threshold is met.
 * - Strongly legitimate service findings: applies ONLY if at least one
 *   nearby finding is independently suspicious (see
 *   `SUSPICIOUS_CORRELATION_RULE_IDS`) — a burst of other legitimate
 *   service installs alone is not enough.
 */
export function shouldApplyCorrelationBonus(
  finding: DetectionFinding,
  correlatedFindings: readonly DetectionFinding[],
  serviceContext: ServiceContext | null,
  pathClassification: PathClassification | null,
  vendorMatch: VendorMatch | null,
): CorrelationDecision {
  const count = correlatedFindings.length;

  if (count < 2) {
    return {
      apply: false,
      count,
      reason: `Only ${count} other finding(s) on this host within ${CORRELATION_WINDOW_MINUTES} minutes - below the correlation threshold.`,
    };
  }

  // Scheduled-task: suppress correlation when the task references
  // a known vendor from a trusted system/application path.
  if (
    finding.ruleId === "scheduled-task" &&
    pathClassification &&
    (pathClassification === "trusted-system" ||
      pathClassification === "trusted-application") &&
    vendorMatch?.matched
  ) {
    return {
      apply: false,
      count,
      reason: `${count} other finding(s) occurred on the same host within ${CORRELATION_WINDOW_MINUTES} minutes, but this scheduled task references a known vendor from a trusted path.`,
    };
  }

  // Existing service-installation legitimacy logic.
  if (
    finding.ruleId === "service-installation" &&
    serviceContext &&
    isStronglyLegitimateService(serviceContext)
  ) {
    const suspiciousNeighbor = correlatedFindings.find(
  (other) =>
    other.ruleId !== finding.ruleId &&
    SUSPICIOUS_CORRELATION_RULE_IDS.has(other.ruleId),
  );

    if (!suspiciousNeighbor) {
      return {
        apply: false,
        count,
        reason: `${count} other finding(s) nearby, but this service matched a known vendor from a trusted path with an ordinary name and none of the nearby findings are independently suspicious - correlation bonus withheld so legitimate installs occurring close together don't amplify each other's confidence.`,
      };
    }

    return {
      apply: true,
      count,
      reason: `${count} other finding(s) occurred on the same host within ${CORRELATION_WINDOW_MINUTES} minutes, including independently suspicious activity ("${suspiciousNeighbor.ruleName}") - correlation bonus applied despite this service's otherwise legitimate context.`,
    };
  }

  return {
    apply: true,
    count,
    reason: `${count} other suspicious finding(s) occurred on the same host within ${CORRELATION_WINDOW_MINUTES} minutes.`,
  };
}
/**
 * Enriches one finding. `correlationIndex`/`findingCountByComputer` are
 * shared, pre-built inputs (see `enrichFindings`) — this function performs
 * no O(events) or O(findings) work of its own beyond the bounded temporal
 * lookups described in this module's header comment.
 */
function enrichOne(
  finding: DetectionFinding,
  ctx: DetectionContext,
  correlationIndex: CorrelationIndex,
  correlatedFindingsFor: (finding: DetectionFinding) => DetectionFinding[],
): DetectionFinding {
  const event = ctx.byId.get(finding.eventId);
  if (!event) {
    // Shouldn't happen (every finding's eventId comes from an event in
    // this same ctx), but stays defensive rather than throwing — returns
    // the finding with only a base confidence, no context.
    const baseRisk = BASE_RISK_BY_SEVERITY[finding.severity];
    return {
      ...finding,
      confidence: baseRisk,
      confidenceLevel: confidenceLevelFor(baseRisk),
      riskScore: baseRisk,
      evidenceSignals: [],
      context: {
        pathClassification: null,
        pathClassificationMeaning: null,
        accountClass: null,
        vendorMatch: null,
        lolbin: null,
        hasEncodedCommand: false,
        correlatedFindingCount: 0,
      },
    };
  }

  const signals: EvidenceSignal[] = [];
  const isServiceInstallation = finding.ruleId === "service-installation";

  const serviceCtx = isServiceInstallation ? analyzeServiceContext(event.message) : null;

  // Path context — service findings use the parsed ImagePath (precise);
  // every other finding runs classification over the raw message text
  // directly (pathContext's patterns match anywhere in a string, so this
  // still catches e.g. an encoded-PowerShell command line that also names
  // a Temp-directory script file).
  const pathSubject = serviceCtx?.imagePath ?? extractExecutablePath(event.message) ?? event.message;
  const pathResult = classifyPath(pathSubject);
  const pathSubjectLabel = isServiceInstallation ? "The service's image path" : "This event's referenced path";
  pathSignal(signals, pathResult, pathSubjectLabel);

  // Vendor context.
  const vendorMatch = serviceCtx?.vendorMatch ?? matchKnownVendor([{ text: event.message, source: "other" }]);
  vendorSignal(signals, vendorMatch);

  // Service-specific naming signal.
 // Service-specific naming and kernel-driver signals.
if (isServiceInstallation && serviceCtx) {
  if (!serviceCtx.unusualName && serviceCtx.serviceName) {
    pushSignal(
      signals,
      "expected-service-naming",
      "Ordinary service name",
      `Service name "${serviceCtx.serviceName}" does not look machine-generated.`,
      RISK_WEIGHTS.expectedServiceNaming,
    );
  } else if (serviceCtx.unusualName) {
    pushSignal(
      signals,
      "unusual-service-name",
      "Unusual service name",
      `Service name "${serviceCtx.serviceName ?? serviceCtx.displayName}" looks machine-generated rather than human-chosen.`,
      RISK_WEIGHTS.unusualServiceName,
    );
  }

  if (serviceCtx.serviceType?.toLowerCase().includes("kernel mode")) {
    pushSignal(
      signals,
      "kernel-mode-driver",
      "Kernel-mode driver service",
      `Service "${serviceCtx.serviceName ?? serviceCtx.displayName}" is registered as a kernel-mode driver.`,
      RISK_WEIGHTS.kernelModeDriver,
    );
  }
}

  // Process-text context (LOLBin / encoded command).
  const processAnalysis = analyzeProcessText(event.message);
  if (processAnalysis.hasEncodedCommand) {
    pushSignal(
      signals,
      "encoded-command",
      "Encoded/obfuscated command",
      `Command text matched: ${processAnalysis.encodedCommandNotes.join(", ")}.`,
      RISK_WEIGHTS.encodedCommand,
    );
  }

  // Account + path combo (SYSTEM from an untrusted path).
  const accountText = resolveAccountText(event, serviceCtx?.account ?? null);
  const accountClass = serviceCtx?.accountClass ?? classifyServiceAccount(accountText);
  accountPathComboSignal(signals, accountClass, pathResult.classification);

  // Suspicious preceding process (proxy for "suspicious parent process").
  const temporal = getTemporalContext(correlationIndex, event.computer, parseTime(event));
  const precedingLolbin = temporal
    .before(PRECEDING_PROCESS_WINDOW_MINUTES)
    .reverse()
    .map((e) => analyzeProcessText(e.message))
    .find((a) => a.lolbin !== null);
  if (precedingLolbin?.lolbin) {
    pushSignal(
      signals,
      "suspicious-preceding-process",
      "Suspicious preceding process",
      `A ${precedingLolbin.lolbin} process event was observed on this host within ${PRECEDING_PROCESS_WINDOW_MINUTES} minute(s) before this finding.`,
      RISK_WEIGHTS.suspiciousPrecedingProcess,
    );
  }

  // Correlated activity burst — context-aware (Phase 5.13.1): see
  // `shouldApplyCorrelationBonus`'s doc comment above for why a strongly
  // legitimate service-installation finding doesn't automatically get this
  // bonus just because other legitimate services happened nearby.
  const correlatedFindings = correlatedFindingsFor(finding);
 const correlationDecision = shouldApplyCorrelationBonus(
  finding,
  correlatedFindings,
  serviceCtx,
  pathResult.classification,
  vendorMatch,
);
  if (correlationDecision.apply) {
    pushSignal(
      signals,
      "correlated-activity",
      "Part of a correlated activity burst",
      correlationDecision.reason,
      RISK_WEIGHTS.correlatedActivity,
    );
  }
  // Note: when the bonus is withheld, no evidence signal is pushed for it
  // at all — this deliberately avoids ever showing a "correlated activity"
  // signal that implies the bonus applied when it didn't (ticket: "Do not
  // leave a misleading evidence message"). The raw nearby count is still
  // reported below via `context.correlatedFindingCount`, so an analyst can
  // see that other findings existed nearby even when they didn't move this
  // finding's confidence.

  const baseRisk = BASE_RISK_BY_SEVERITY[finding.severity];
  const confidence = calculateFindingConfidence(baseRisk, signals);

  const context: DetectionContextSummary = {
    pathClassification: pathResult.classification === "unknown" ? null : pathResult.classification,
    pathClassificationMeaning: pathResult.classification === "unknown" ? null : PATH_CLASSIFICATION_MEANING[pathResult.classification],
    accountClass: accountClass === "unknown" ? null : accountClass,
    vendorMatch: vendorMatch.vendor,
    lolbin: processAnalysis.lolbin,
    hasEncodedCommand: processAnalysis.hasEncodedCommand,
    correlatedFindingCount: correlationDecision.count,
  };

  return {
    ...finding,
    confidence,
    confidenceLevel: confidenceLevelFor(confidence),
    riskScore: confidence,
    evidenceSignals: signals,
    context,
  };
}

/**
 * Enriches every finding with context/confidence/evidence — the single
 * function `engine.ts#runDetectionEngine` calls as its last step. Never
 * throws and never drops a finding: the output array has exactly the same
 * length, in the same order, as the input (ticket: "The investigator must
 * still be able to see them" — enrichment only ever ADDS fields).
 */
export function enrichFindings(findings: readonly DetectionFinding[], ctx: DetectionContext): DetectionFinding[] {
  if (findings.length === 0) return [];

  const correlationIndex = buildCorrelationIndex(ctx);

  // Group findings by computer once — bounded by finding count (typically
  // tens to low thousands), never event count. Each group is then sorted
  // by time once so `correlatedFindingsFor` below can binary-search it too,
  // rather than a linear scan per finding.
  const findingsByComputer = new Map<string, Array<{ finding: DetectionFinding; timeMs: number }>>();
  for (const finding of findings) {
    const event = ctx.byId.get(finding.eventId);
    if (!event) continue;
    const entry = { finding, timeMs: parseTime(event) };
    const bucket = findingsByComputer.get(event.computer);
    if (bucket) bucket.push(entry);
    else findingsByComputer.set(event.computer, [entry]);
  }
  for (const bucket of findingsByComputer.values()) bucket.sort((a, b) => a.timeMs - b.timeMs);

  /**
   * Returns the OTHER findings (never including `finding` itself) on the
   * same host within `CORRELATION_WINDOW_MINUTES` — same binary-search
   * window this function always used, just returning the matched findings
   * themselves (Phase 5.13.1) instead of only a count, so
   * `shouldApplyCorrelationBonus` can inspect what kind of activity is
   * actually nearby. No second scan: still one binary search plus a
   * bounded walk of the matched window, exactly as before.
   */
  function correlatedFindingsFor(finding: DetectionFinding): DetectionFinding[] {
    const event = ctx.byId.get(finding.eventId);
    if (!event) return [];
    const bucket = findingsByComputer.get(event.computer);
    if (!bucket || bucket.length <= 1) return [];

    const timeMs = parseTime(event);
    const windowMs = CORRELATION_WINDOW_MINUTES * 60_000;
    let lo = 0;
    let hi = bucket.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (bucket[mid].timeMs < timeMs - windowMs) lo = mid + 1;
      else hi = mid;
    }
    const nearby: DetectionFinding[] = [];
    for (let i = lo; i < bucket.length && bucket[i].timeMs <= timeMs + windowMs; i++) {
      if (bucket[i].finding.id !== finding.id) nearby.push(bucket[i].finding);
    }
    return nearby;
  }

  return findings.map((finding) => enrichOne(finding, ctx, correlationIndex, correlatedFindingsFor));
}

// ---------------------------------------------------------------------------
// Explanation (ticket section 13)
// ---------------------------------------------------------------------------

export interface FindingExplanation {
  positiveSignals: EvidenceSignal[];
  negativeSignals: EvidenceSignal[];
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  summary: string;
}

/**
 * Structures a finding's `evidenceSignals` into the shape
 * `EventDetailsDrawer`'s "Why was this detected?" section and the PDF
 * report render directly — positive (legitimacy) and negative (suspicion)
 * signals split and sorted by magnitude, plus a one-line human-readable
 * summary. Never throws: a finding enrichment hasn't touched yet (no
 * `evidenceSignals`) returns an all-empty explanation rather than crashing
 * whatever UI called this defensively.
 */
export function getFindingExplanation(finding: DetectionFinding): FindingExplanation {
  const signals = finding.evidenceSignals ?? [];
  const positiveSignals = signals.filter((s) => s.severity === "positive").sort((a, b) => a.weight - b.weight);
  const negativeSignals = signals.filter((s) => s.severity === "negative").sort((a, b) => b.weight - a.weight);
  const confidence = finding.confidence ?? BASE_RISK_BY_SEVERITY[finding.severity];
  const confidenceLevel = finding.confidenceLevel ?? confidenceLevelFor(confidence);

  const summary =
    signals.length === 0
      ? `No additional context signals were available; confidence reflects the base rule severity (${confidence}/100, ${confidenceLevel}).`
      : `${negativeSignals.length} suspicion signal(s) and ${positiveSignals.length} legitimacy signal(s) combine to a confidence of ${confidence}/100 (${confidenceLevel}).`;

  return { positiveSignals, negativeSignals, confidence, confidenceLevel, summary };
}

// ---------------------------------------------------------------------------
// Threat Score breakdown (ticket sections 15-16)
// ---------------------------------------------------------------------------

export type ThreatScoreCategory = "Minimal" | "Low" | "Moderate" | "High" | "Critical";

const SCORE_CATEGORY_THRESHOLDS: Array<{ min: number; category: ThreatScoreCategory }> = [
  { min: 80, category: "Critical" },
  { min: 60, category: "High" },
  { min: 40, category: "Moderate" },
  { min: 20, category: "Low" },
  { min: 0, category: "Minimal" },
];

/** Ticket section 15's 5-category label for a 0-100 case score — a purely
 * additive, display-only categorization layered on top of the existing
 * 4-value `RiskLevel` (`backend/risk-score.ts`), never a replacement for
 * it. */
export function scoreCategoryFor(score: number): ThreatScoreCategory {
  const clamped = Math.max(0, Math.min(100, score));
  return SCORE_CATEGORY_THRESHOLDS.find((t) => clamped >= t.min)?.category ?? "Minimal";
}

export interface ThreatFactorTally {
  label: string;
  occurrences: number;
}

export interface ThreatScoreBreakdown {
  overallScore: number;
  category: ThreatScoreCategory;
  criticalCount: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  /** Most common suspicion-signal labels across every finding, most
   * frequent first, capped at 5. */
  topRiskFactors: ThreatFactorTally[];
  /** Most common legitimacy-signal labels across every finding, most
   * frequent first, capped at 5. */
  topLegitimateIndicators: ThreatFactorTally[];
}

const MAX_TOP_FACTORS = 5;

function topSignalLabels(findings: readonly DetectionFinding[], severity: "positive" | "negative"): ThreatFactorTally[] {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    for (const signal of finding.evidenceSignals ?? []) {
      if (signal.severity !== severity) continue;
      counts.set(signal.label, (counts.get(signal.label) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, occurrences]) => ({ label, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, MAX_TOP_FACTORS);
}

/**
 * Explanatory breakdown for the Dashboard's Threat Score panel (ticket
 * section 16) — deliberately takes `caseScore` as a parameter rather than
 * recomputing it: the authoritative case-level number is
 * `backend/risk-score.ts#computeRiskScore`'s job (confidence-weighted +
 * dedup), this function only adds the qualitative "why" on top of
 * whatever that number already is. Never throws on an empty finding set —
 * returns an all-zero breakdown.
 */
export function computeThreatScoreBreakdown(
  findings: readonly DetectionFinding[],
  caseScore: number,
): ThreatScoreBreakdown {
  let criticalCount = 0;
  let highConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let lowConfidenceCount = 0;

  for (const finding of findings) {
    switch (finding.confidenceLevel) {
      case "critical":
        criticalCount++;
        break;
      case "high":
        highConfidenceCount++;
        break;
      case "medium":
        mediumConfidenceCount++;
        break;
      case "low":
      default:
        lowConfidenceCount++;
        break;
    }
  }

  return {
    overallScore: caseScore,
    category: scoreCategoryFor(caseScore),
    criticalCount,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    topRiskFactors: topSignalLabels(findings, "negative"),
    topLegitimateIndicators: topSignalLabels(findings, "positive"),
  };
}
