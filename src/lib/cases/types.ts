/**
 * Case Management — shared types (Phase 5.10).
 *
 * Pure data only, no React/Zustand/storage I/O — mirrors every other
 * feature's `types.ts` in this project (e.g. `lib/mitre/types.ts`).
 */
import type { RiskLevel } from "@/types/evidence";

/**
 * Persisted, metadata-only record for one investigation. Deliberately
 * carries *no* `EvtxEvent[]`, `DetectionFinding[]`, or any other raw
 * evidence — every numeric field here is a snapshot (a count, a score, a
 * size in bytes) captured at the moment the case was last saved, per this
 * phase's "Persist metadata using localStorage. Do NOT persist the raw
 * EVTX events." requirement. See `storage.ts` for how this is written to
 * and read from `localStorage`.
 *
 * `id` is the same value `evidenceStore.uploadedFile.name` already is —
 * the synthesized (single- or multi-file) case identifier every other
 * subsystem in this app (`lib/notes.ts`, `lib/bookmarks.ts`,
 * `CaseStateGate`, the PDF report's cover page) already uses as its
 * "caseId" namespace key. Reusing it here rather than minting a separate
 * UUID is what lets `notesCount`/`bookmarksCount` below resolve against
 * those existing per-case stores without a second id-mapping layer, and
 * lets re-uploading the same investigation update its existing case
 * record instead of creating a duplicate.
 */
export interface CaseMetadata {
  id: string;
  /** User-editable display label (Rename dialog). Defaults to `id` at
   * creation time and is the ONLY field a rename changes — `id` itself
   * never changes, so notes/bookmarks/"reopen" lookups keyed on it keep
   * working after a rename. */
  name: string;
  /** ISO 8601 — set once, the first time this case is saved. */
  createdAt: string;
  /** ISO 8601 — bumped every time this case's metadata is (re-)saved
   * (e.g. re-uploading the same source file(s) refreshes counts). */
  updatedAt: string;
  /** ISO 8601 — bumped only when the analyst actively opens/reopens this
   * case from the Case Library or Recent Cases, distinct from `updatedAt`
   * (which tracks data changes, not viewing). */
  lastOpened: string;
  eventCount: number;
  findingCount: number;
  mitreTechniqueCount: number;
  /** 0-100, copied from `InvestigationSummary.riskScore.score` — not
   * recomputed here (this module never touches the Detection Engine). */
  threatScore: number;
  /** Copied from `InvestigationSummary.riskScore.level` alongside
   * `threatScore` above, so badge coloring (`CaseCard`/`CaseList`) reuses
   * the exact same low/medium/high/critical thresholds
   * `backend/risk-score.ts` already defines, instead of re-deriving them
   * from `threatScore` a second time. */
  threatLevel: RiskLevel;
  sourceFiles: string[];
  /** Total bytes across every source file, in the same units
   * `lib/utils.ts#formatFileSize` already knows how to format. */
  fileSize: number;
  notesCount: number;
  bookmarksCount: number;
}

/** Fields a caller supplies when saving/refreshing a case's metadata —
 * everything in `CaseMetadata` except the bookkeeping timestamps
 * (`createdAt`/`updatedAt`/`lastOpened`, owned by `storage.ts#upsertCase`)
 * and the user-controlled `name` (owned by `renameCase`, never
 * overwritten by a metadata refresh). */
export type CaseUpsertInput = Omit<CaseMetadata, "name" | "createdAt" | "updatedAt" | "lastOpened">;

export type CaseSortOrder = "newest" | "oldest" | "highest-threat" | "most-events";

export const DEFAULT_CASE_SORT_ORDER: CaseSortOrder = "newest";

export const CASE_SORT_LABEL: Record<CaseSortOrder, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "highest-threat": "Highest Threat",
  "most-events": "Most Events",
};

export type CaseViewMode = "grid" | "list";

/** Display label for a case's `threatLevel` — matches
 * `RiskScoreCard.tsx`'s own `LEVEL_STYLES` labels so a case's threat
 * level always reads the same word whether it's shown on the Dashboard's
 * gauge or a Case Library card. Kept here (not inline in `CaseCard.tsx`)
 * so it's a plain exported constant rather than a component co-export —
 * `MitreSeverityDistribution.tsx`'s Sprint 5.9.2 fix established this
 * same "move the shared constant into `lib/*`" pattern to avoid
 * `react-refresh/only-export-components`. */
export const CASE_THREAT_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** `Badge`'s `variant` prop has no dedicated "high" tier (only
 * critical/warning/success/…), so `high` maps onto the same "critical"
 * badge styling `medium`->`warning`/`low`->`success` would suggest by
 * pattern — the badge's text label (`CASE_THREAT_LABEL`) is what actually
 * distinguishes "High" from "Critical" for the reader. */
export const CASE_THREAT_BADGE_VARIANT: Record<RiskLevel, "success" | "warning" | "critical"> = {
  low: "success",
  medium: "warning",
  high: "critical",
  critical: "critical",
};

export interface CaseLibraryStats {
  totalCases: number;
  /** Rounded to 1 decimal place; 0 when there are no cases. */
  averageThreatScore: number;
  totalEvents: number;
  totalFindings: number;
}
