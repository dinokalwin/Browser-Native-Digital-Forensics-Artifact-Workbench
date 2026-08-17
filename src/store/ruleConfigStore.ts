import * as React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { getAllRules } from "@/lib/detection/registry";
import { loadRuleConfig, saveRuleConfig, type RuleEnabledMap } from "@/lib/detection/ruleConfig";

/**
 * Configurable Rule Set (Phase 5 Item 2) — reactive layer over
 * `lib/detection/ruleConfig.ts`, same role and shape as
 * `store/caseStore.ts`: `localStorage` (via `ruleConfig.ts`) is the real
 * source of truth, this store is an in-memory mirror components subscribe
 * to. Like `caseStore.ts`, there's exactly one thing to hydrate (the whole
 * rule-enabled map, not one rule at a time), so this store hydrates once,
 * lazily, on first use via `useHydrateRuleConfigStore` below.
 *
 * `enabledByRuleId`'s initial value (before hydration) is already
 * `defaultEnabledMap()` — every currently-registered rule id mapped to
 * `true` — not an empty object. This matters: `evidenceStore.ts` reads
 * this store via `getEnabledRuleIds()` at file-load time, and per this
 * phase's "existing behavior must remain the default / never disable a
 * detection because configuration is missing" requirement, that read must
 * be safe even if hydration hasn't happened yet (e.g. an analyst who
 * uploads a file without ever visiting the Settings page in that
 * session). `evidenceStore.loadFiles` still calls `hydrate()` itself
 * first (cheap, idempotent) so a *previously saved* customization is
 * actually honored — this initial value is the fallback for the
 * zero-customization case, not a substitute for hydrating.
 */

interface RuleConfigState {
  enabledByRuleId: RuleEnabledMap;
  hydrated: boolean;

  hydrate: () => void;
  setRuleEnabled: (ruleId: string, enabled: boolean) => void;
  resetToDefaults: () => void;
}

/** Every currently-registered rule id, defaulted to enabled — the "safe
 * default" this whole feature is built around: a rule id this map doesn't
 * mention (because it's brand new, or because storage was never written)
 * behaves exactly as if the Configurable Rule Set didn't exist at all. */
function defaultEnabledMap(): RuleEnabledMap {
  const map: RuleEnabledMap = {};
  for (const rule of getAllRules()) map[rule.id] = true;
  return map;
}

export const useRuleConfigStore = create<RuleConfigState>()(
  devtools(
    (set, get) => ({
      enabledByRuleId: defaultEnabledMap(),
      hydrated: false,

      hydrate: () => {
        if (get().hydrated) return;
        const stored = loadRuleConfig();
        // Start from the safe-default map (every current rule -> true),
        // then overlay only the ids `stored` and the current registry
        // *both* recognize. This is what makes an unknown/stale id in
        // storage (a since-removed/renamed rule) a safe no-op rather than
        // introducing a phantom entry, and what makes a brand-new rule
        // (never in this analyst's saved config) default to enabled.
        const merged = defaultEnabledMap();
        for (const ruleId of Object.keys(merged)) {
          if (typeof stored[ruleId] === "boolean") merged[ruleId] = stored[ruleId];
        }
        set({ enabledByRuleId: merged, hydrated: true }, false, "ruleConfig/hydrate");
      },

      setRuleEnabled: (ruleId, enabled) => {
        const next = { ...get().enabledByRuleId, [ruleId]: enabled };
        set({ enabledByRuleId: next }, false, "ruleConfig/setRuleEnabled");
        saveRuleConfig(next);
      },

      resetToDefaults: () => {
        const defaults = defaultEnabledMap();
        set({ enabledByRuleId: defaults }, false, "ruleConfig/resetToDefaults");
        saveRuleConfig(defaults);
      },
    }),
    { name: "rule-config-store" },
  ),
);

/** Ensures the saved rule configuration has been loaded from `localStorage`
 * into the store. Cheap and idempotent (guarded by `hydrated`), safe to
 * call from every rule-config-aware call site (the Settings page,
 * `evidenceStore.loadFiles`) regardless of which one runs first — same
 * reasoning as `caseStore.ts`'s `useHydrateCaseStore`. */
export function useHydrateRuleConfigStore(): void {
  const hydrate = useRuleConfigStore((s) => s.hydrate);
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);
}

/** Non-reactive snapshot of every *currently enabled* rule id, for
 * `evidenceStore.loadFiles` (a store action, not a component) to pass
 * into `detectIOCs`/`runDetectionEngine`. Calls `hydrate()` itself first
 * — see this file's module doc comment for why that matters even though
 * the store's own initial state is already a safe all-enabled default. */
export function getEnabledRuleIds(): ReadonlySet<string> {
  useRuleConfigStore.getState().hydrate();
  const { enabledByRuleId } = useRuleConfigStore.getState();
  const ids = new Set<string>();
  for (const rule of getAllRules()) {
    // `?? true` — the same safe default as everywhere else in this
    // module: a rule id absent from the map (new rule, never customized)
    // is enabled, not silently dropped.
    if (enabledByRuleId[rule.id] ?? true) ids.add(rule.id);
  }
  return ids;
}
