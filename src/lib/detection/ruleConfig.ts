/**
 * Configurable Rule Set — persistence (Phase 5 Item 2, SDD §7 Nice to
 * Have: "Configurable/extensible detection rule set (e.g. a rules panel
 * to enable/disable individual heuristics)").
 *
 * Same shape and conventions as `lib/cases/storage.ts`/`lib/notes.ts`/
 * `lib/bookmarks.ts`: pure, framework-free `localStorage` I/O, defensive
 * about a missing/disabled/corrupt `localStorage` (never throws — a failed
 * read/write just means the preference doesn't persist that session, not
 * a crash). `store/ruleConfigStore.ts` is the only thing that imports this
 * module; UI components never touch it directly.
 *
 * This is a single global preference (which heuristics run), not
 * case-scoped data, so — like `theme-provider.tsx`'s theme choice — it
 * lives under one fixed key rather than being namespaced per case the way
 * notes/bookmarks are.
 */

const STORAGE_KEY = "dfir-workbench:detection:rule-config";

/** Rule id -> whether it's enabled. Only ids the *current* rule registry
 * (`registry.ts#getAllRules`) actually recognizes are ever applied when
 * this is loaded — see `ruleConfigStore.ts#hydrate` — so a stale id left
 * over from a since-removed/renamed rule is harmless dead weight, never a
 * crash or an unintended effect. */
export type RuleEnabledMap = Record<string, boolean>;

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
    // this preference is a convenience layer; detection still runs (with
    // every rule enabled, the safe default — see ruleConfigStore.ts)
    // regardless of whether this write succeeds.
  }
}

/** Defensive narrowing for whatever `localStorage` actually contains —
 * guards against a hand-edited or corrupt value that isn't a
 * `Record<string, boolean>`, rather than trusting `JSON.parse`'s
 * `unknown` result blindly. An entry whose value isn't a boolean is
 * dropped rather than the whole map being discarded, so one malformed
 * entry can't take out every other saved preference. */
function isRuleEnabledMap(value: unknown): value is RuleEnabledMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every rule id explicitly saved, with whatever boolean value it was last
 * set to. Ids not present here are simply unknown to this module — the
 * caller (`ruleConfigStore.ts#hydrate`) is what applies the "absent = enabled"
 * safe default against the *current* rule registry, not this function. */
export function loadRuleConfig(): RuleEnabledMap {
  const raw = readJSON<Record<string, unknown>>(STORAGE_KEY);
  if (!isRuleEnabledMap(raw)) return {};
  const map: RuleEnabledMap = {};
  for (const [ruleId, value] of Object.entries(raw)) {
    if (typeof value === "boolean") map[ruleId] = value;
  }
  return map;
}

export function saveRuleConfig(config: RuleEnabledMap): void {
  writeJSON(STORAGE_KEY, config);
}
