// @vitest-environment jsdom
/**
 * Phase 5 Item 2 — Configurable Rule Set. `ruleConfigStore` is the
 * reactive layer over `lib/detection/ruleConfig.ts` (localStorage) —
 * jsdom required for the same reason as `ruleConfig.test.ts`. The store
 * module is a singleton (like every Zustand store in this project), so
 * each test explicitly resets both its in-memory state and
 * `localStorage` rather than relying on file-load-time initial state,
 * which would only be correct for the very first test.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { getAllRules } from "@/lib/detection/registry";
import { loadRuleConfig } from "@/lib/detection/ruleConfig";
import { getEnabledRuleIds, useRuleConfigStore } from "../ruleConfigStore";

const ALL_RULE_IDS = getAllRules().map((r) => r.id);

function resetStoreToFreshAppLoad() {
  window.localStorage.clear();
  // Mirrors the module's own real initial state (every current rule id ->
  // enabled), but with `hydrated: false` — the state a fresh page load
  // would actually have before anything calls `hydrate()`.
  const enabledByRuleId: Record<string, boolean> = {};
  for (const id of ALL_RULE_IDS) enabledByRuleId[id] = true;
  useRuleConfigStore.setState({ enabledByRuleId, hydrated: false });
}

beforeEach(() => {
  resetStoreToFreshAppLoad();
});

describe("ruleConfigStore", () => {
  it("defaults every currently-registered rule to enabled before hydration (safe default)", () => {
    const { enabledByRuleId, hydrated } = useRuleConfigStore.getState();
    expect(hydrated).toBe(false);
    for (const id of ALL_RULE_IDS) {
      expect(enabledByRuleId[id]).toBe(true);
    }
  });

  it("hydrate() loads a previously saved override and merges it with the safe-default map", () => {
    window.localStorage.setItem(
      "dfir-workbench:detection:rule-config",
      JSON.stringify({ "brute-force": false }),
    );

    useRuleConfigStore.getState().hydrate();

    const { enabledByRuleId, hydrated } = useRuleConfigStore.getState();
    expect(hydrated).toBe(true);
    expect(enabledByRuleId["brute-force"]).toBe(false);
    // Every other rule is untouched by the override — still enabled.
    for (const id of ALL_RULE_IDS.filter((i) => i !== "brute-force")) {
      expect(enabledByRuleId[id]).toBe(true);
    }
  });

  it("ignores a stale/unknown rule id in storage rather than erroring or introducing a phantom entry", () => {
    window.localStorage.setItem(
      "dfir-workbench:detection:rule-config",
      JSON.stringify({ "this-rule-id-does-not-exist": false, "brute-force": false }),
    );

    expect(() => useRuleConfigStore.getState().hydrate()).not.toThrow();
    const { enabledByRuleId } = useRuleConfigStore.getState();
    expect(enabledByRuleId["brute-force"]).toBe(false);
    expect(enabledByRuleId["this-rule-id-does-not-exist"]).toBeUndefined();
  });

  it("hydrate() is idempotent — a second call doesn't re-read a since-changed localStorage value", () => {
    useRuleConfigStore.getState().hydrate();
    window.localStorage.setItem(
      "dfir-workbench:detection:rule-config",
      JSON.stringify({ "brute-force": false }),
    );
    useRuleConfigStore.getState().hydrate(); // guarded by `hydrated`, should no-op
    expect(useRuleConfigStore.getState().enabledByRuleId["brute-force"]).toBe(true);
  });

  it("setRuleEnabled updates in-memory state and persists the full map to localStorage", () => {
    useRuleConfigStore.getState().setRuleEnabled("brute-force", false);

    expect(useRuleConfigStore.getState().enabledByRuleId["brute-force"]).toBe(false);
    expect(loadRuleConfig()["brute-force"]).toBe(false);
  });

  it("re-enabling a disabled rule via setRuleEnabled restores it in state and storage", () => {
    useRuleConfigStore.getState().setRuleEnabled("brute-force", false);
    useRuleConfigStore.getState().setRuleEnabled("brute-force", true);

    expect(useRuleConfigStore.getState().enabledByRuleId["brute-force"]).toBe(true);
    expect(loadRuleConfig()["brute-force"]).toBe(true);
  });

  it("resetToDefaults re-enables every rule and persists that", () => {
    useRuleConfigStore.getState().setRuleEnabled("brute-force", false);
    useRuleConfigStore.getState().setRuleEnabled("usb-device", false);

    useRuleConfigStore.getState().resetToDefaults();

    const { enabledByRuleId } = useRuleConfigStore.getState();
    for (const id of ALL_RULE_IDS) expect(enabledByRuleId[id]).toBe(true);
    const stored = loadRuleConfig();
    for (const id of ALL_RULE_IDS) expect(stored[id]).toBe(true);
  });

  describe("getEnabledRuleIds", () => {
    it("returns every rule id when configuration has never been customized", () => {
      const ids = getEnabledRuleIds();
      expect([...ids].sort()).toEqual([...ALL_RULE_IDS].sort());
    });

    it("excludes a disabled rule's id", () => {
      useRuleConfigStore.getState().setRuleEnabled("brute-force", false);
      const ids = getEnabledRuleIds();
      expect(ids.has("brute-force")).toBe(false);
      expect(ids.has("usb-device")).toBe(true);
    });

    it("includes a re-enabled rule's id again", () => {
      useRuleConfigStore.getState().setRuleEnabled("brute-force", false);
      useRuleConfigStore.getState().setRuleEnabled("brute-force", true);
      expect(getEnabledRuleIds().has("brute-force")).toBe(true);
    });

    it("hydrates from a previously saved preference even if hydrate() was never explicitly called first (simulating a fresh app load)", () => {
      // Seed localStorage as if a *previous session* disabled this rule,
      // then reset the store to pre-hydration state (see
      // resetStoreToFreshAppLoad) without calling hydrate() ourselves —
      // getEnabledRuleIds() itself must hydrate before reading.
      window.localStorage.setItem(
        "dfir-workbench:detection:rule-config",
        JSON.stringify({ "brute-force": false }),
      );
      resetStoreToFreshAppLoad();
      window.localStorage.setItem(
        "dfir-workbench:detection:rule-config",
        JSON.stringify({ "brute-force": false }),
      );

      expect(useRuleConfigStore.getState().hydrated).toBe(false);
      const ids = getEnabledRuleIds();
      expect(ids.has("brute-force")).toBe(false);
    });
  });
});
