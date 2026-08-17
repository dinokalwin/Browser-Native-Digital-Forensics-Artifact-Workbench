/**
 * Export Center — export history persistence (Phase 5.11, ticket
 * "12. Export History").
 *
 * Same shape and contract as `lib/cases/storage.ts`: pure, framework-free
 * `localStorage` I/O, defensive about a missing/disabled/corrupt storage
 * (never throws), single key holding the whole (small, capped) list rather
 * than one key per entry. `store/exportStore.ts` is the only thing that
 * imports this module directly.
 *
 * Stores only lightweight metadata — filename, format, timestamp, status —
 * per this phase's explicit "Do NOT store exported files" instruction:
 * there is no field here that could hold a `Blob`/file contents even by
 * accident.
 */
import type { ExportFormat, ExportHistoryEntry } from "./types";

const STORAGE_KEY = "dfir-workbench:export-history";

/** "Display the latest 10 exports" — enforced at both write time (so the
 * persisted list itself never grows unbounded) and read time (defensive
 * against a larger list written by a future version of this app). */
const MAX_ENTRIES = 10;

function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded, private-browsing restrictions, storage disabled —
    // export history is a convenience layer; a failed write here must
    // never prevent the export itself (already downloaded by the time
    // this is called) from having succeeded.
  }
}

/** Defensive narrowing for whatever `localStorage` actually contains,
 * matching `lib/cases/storage.ts#isCaseMetadata`'s "drop malformed
 * entries, don't discard the whole list" precedent. */
function isExportHistoryEntry(value: unknown): value is ExportHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.filename === "string" &&
    typeof record.format === "string" &&
    typeof record.timestamp === "string" &&
    (record.status === "success" || record.status === "failed")
  );
}

export function loadExportHistory(): ExportHistoryEntry[] {
  const raw = readJSON<unknown[]>(STORAGE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isExportHistoryEntry).slice(0, MAX_ENTRIES);
}

let idCounter = 0;

/** Monotonic, human-readable id — same "module-level counter is safe since
 * this never runs concurrently with itself" reasoning
 * `lib/detection/types.ts#makeFindingId` already documents. */
function nextExportHistoryId(): string {
  idCounter += 1;
  return `export-${Date.now()}-${idCounter}`;
}

/** Records one export attempt and returns the entry that was written —
 * prepended (newest first), capped at `MAX_ENTRIES`. Called for both
 * successful and failed exports (ticket's "✓ Failed export handling"),
 * so an investigator can see *and* explain a failure after the fact, not
 * just successes. */
export function recordExport(filename: string, format: ExportFormat, status: "success" | "failed"): ExportHistoryEntry {
  const entry: ExportHistoryEntry = {
    id: nextExportHistoryId(),
    filename,
    format,
    timestamp: new Date().toISOString(),
    status,
  };
  const next = [entry, ...loadExportHistory()].slice(0, MAX_ENTRIES);
  writeJSON(STORAGE_KEY, next);
  return entry;
}

export function clearExportHistory(): void {
  writeJSON(STORAGE_KEY, []);
}
