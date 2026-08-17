/**
 * Case Management — persistence (Phase 5.10).
 *
 * Same shape and same conventions as `lib/notes.ts`/`lib/bookmarks.ts`:
 * pure, framework-free `localStorage` I/O, defensive about a missing/
 * disabled/corrupt `localStorage` (never throws — a failed read/write just
 * means the case library doesn't persist that session, not a crash).
 * `store/caseStore.ts` is the only thing that imports this module; UI
 * components never touch it directly.
 *
 * Unlike notes/bookmarks (namespaced per case, one `localStorage` key per
 * case id), every case's metadata lives together under one key — the
 * whole point of this module is to be a small *index* of investigations,
 * so callers (the Cases page's search/sort, `RecentCases`, `CaseStatistics`)
 * need the full set at once rather than one case at a time.
 */
import type { CaseMetadata, CaseUpsertInput } from "./types";

const STORAGE_KEY = "dfir-workbench:cases:index";

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
    // the case library is a convenience layer, not the investigation
    // itself (which still works fully from evidenceStore for the
    // currently-loaded case regardless of whether this write succeeds).
  }
}

/** Defensive narrowing for whatever `localStorage` actually contains —
 * guards against a hand-edited or pre-this-phase value that isn't the
 * `Record<string, CaseMetadata>` shape this module expects, rather than
 * trusting `JSON.parse`'s `unknown` result blindly. Any entry missing a
 * string `id` is dropped rather than the whole index being discarded, so
 * one malformed record can't take out every other saved case. */
function isCaseMetadata(value: unknown): value is CaseMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0
  );
}

function readIndex(): Record<string, CaseMetadata> {
  const raw = readJSON<Record<string, unknown>>(STORAGE_KEY);
  if (!raw || typeof raw !== "object") return {};
  const index: Record<string, CaseMetadata> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (isCaseMetadata(value)) index[id] = value;
  }
  return index;
}

function writeIndex(index: Record<string, CaseMetadata>): void {
  writeJSON(STORAGE_KEY, index);
}

/** Every saved case, in no particular order — callers that need a
 * specific order (newest first, highest threat, …) go through
 * `lib/cases/statistics.ts#sortCases`, keeping ordering logic in one
 * place instead of duplicated at each read site. */
export function loadCases(): CaseMetadata[] {
  return Object.values(readIndex());
}

export function getCase(id: string): CaseMetadata | null {
  return readIndex()[id] ?? null;
}

/**
 * Creates a new case record, or refreshes an existing one's computed
 * fields — the single entry point `caseStore.ts` calls both right after a
 * fresh investigation finishes parsing (Dashboard Integration) and any
 * time the same investigation is re-analyzed. `id` is the join key (see
 * `CaseMetadata`'s doc comment): if a record with this `id` already
 * exists, its `name`/`createdAt`/`lastOpened` are preserved untouched —
 * only the computed snapshot fields and `updatedAt` change — so
 * re-uploading the same source file(s) refreshes counts without
 * clobbering a rename or resetting when the case was first created.
 *
 * O(1) — this module keeps the index as an id-keyed map internally
 * precisely so create/update/delete are never a linear scan over every
 * saved case, comfortably inside this phase's "O(n) metadata updates"
 * budget.
 */
export function upsertCase(input: CaseUpsertInput): CaseMetadata {
  const index = readIndex();
  const existing = index[input.id];
  const now = new Date().toISOString();

  const record: CaseMetadata = {
    ...input,
    name: existing?.name ?? input.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastOpened: existing?.lastOpened ?? now,
  };

  index[input.id] = record;
  writeIndex(index);
  return record;
}

/** Renames a case's display label only — `id` (and therefore every
 * notes/bookmarks lookup keyed on it) is untouched. Returns `null` without
 * writing anything if `id` isn't a saved case, matching this module's
 * "never throw, degrade gracefully" contract. */
export function renameCase(id: string, name: string): CaseMetadata | null {
  const index = readIndex();
  const existing = index[id];
  if (!existing) return null;

  const trimmed = name.trim();
  const record: CaseMetadata = { ...existing, name: trimmed.length > 0 ? trimmed : existing.name };
  index[id] = record;
  writeIndex(index);
  return record;
}

/** Marks a case as just-opened (`lastOpened` -> now) without touching any
 * other field — used by the Cases page / Recent Cases "Open" action, kept
 * separate from `upsertCase` since opening a case doesn't change any of
 * its computed data. Returns `null` without writing anything if `id`
 * isn't a saved case. */
export function markCaseOpened(id: string): CaseMetadata | null {
  const index = readIndex();
  const existing = index[id];
  if (!existing) return null;

  const record: CaseMetadata = { ...existing, lastOpened: new Date().toISOString() };
  index[id] = record;
  writeIndex(index);
  return record;
}

/** Removes a case's metadata record. A no-op (not an error) if `id` isn't
 * a saved case. Deliberately does NOT touch that case's notes/bookmarks
 * (`lib/notes.ts`/`lib/bookmarks.ts`'s own `localStorage` keys) — deleting
 * a case from the *library* is a metadata-only operation, matching this
 * phase's scope; an analyst's notes on a case aren't destroyed just
 * because its library card was removed. */
export function deleteCase(id: string): void {
  const index = readIndex();
  if (!(id in index)) return;
  delete index[id];
  writeIndex(index);
}
