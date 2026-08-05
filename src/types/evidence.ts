/**
 * Shared domain types for parsed EVTX evidence, and for the derived
 * analysis (suspicious findings, investigation summary, risk score) built
 * on top of it in src/backend/*.
 */

export type EventLevel = "Critical" | "Error" | "Warning" | "Information" | "Verbose";

export interface EvtxEvent {
  id: string;
  timestamp: string; // ISO 8601
  eventId: number;
  provider: string;
  computer: string;
  /** Account associated with the event, e.g. "DOMAIN\\jsmith" or "NT AUTHORITY\\SYSTEM". */
  user: string;
  level: EventLevel;
  channel: string;
  message: string;
  /** Raw XML/JSON payload for detail drill-down, opaque to the UI. */
  raw?: unknown;
  /**
   * Originating filename for this event (Phase 5.7 — Multi-EVTX
   * Investigation). Optional, not required, because the protected parser
   * core (`backend/engine/record-mapper.ts`, which constructs every
   * `EvtxEvent` literal) must not be modified — it has no knowledge of
   * which file it's parsing. Instead `evidenceStore.ts` tags every event
   * with its source filename immediately after `parseEVTX` returns, as
   * part of the multi-file merge step (see `lib/multiFile.ts`), so by the
   * time an event reaches any UI component `sourceFile` is always present
   * in practice — this field only reads as possibly-undefined here to keep
   * that construction boundary honest at the type level.
   */
  sourceFile?: string;
}

export type SuspicionSeverity = "critical" | "warning" | "informational";

export interface SuspiciousFinding {
  id: string;
  eventId: string; // FK -> EvtxEvent.id
  title: string;
  description: string;
  severity: SuspicionSeverity;
  mitreTechnique?: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskScore {
  /** 0-100 */
  score: number;
  level: RiskLevel;
}

export interface InvestigationSummary {
  generatedAt: string; // ISO 8601
  headline: string;
  narrative: string;
  keyFindings: string[];
  affectedHosts: string[];
  timeRange: { start: string; end: string };
  riskScore: RiskScore;
}

export interface UploadedFileMeta {
  name: string;
  sizeBytes: number;
  uploadedAt: string; // ISO 8601
}

export type LoadStatus = "idle" | "parsing" | "analyzing" | "ready" | "error";

export interface DateRange {
  start: string | null;
  end: string | null;
}

export interface EvidenceFilters {
  eventId: number | null;
  provider: string | null;
  level: EventLevel | null;
  channel: string | null;
  dateRange: DateRange;
}

export type ExportFormat = "csv" | "json";
