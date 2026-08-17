// @vitest-environment jsdom
/**
 * Phase 5 Item 2 — Configurable Rule Set. Pure `localStorage` persistence
 * for the rule-enabled map, same conventions/test shape as this project
 * would use for `lib/cases/storage.ts` (which has no dedicated test file
 * of its own yet) — jsdom is required here because this module reads
 * `window.localStorage` directly (matching that module's own convention),
 * which the project's default "node" Vitest environment doesn't provide.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { loadRuleConfig, saveRuleConfig } from "../ruleConfig";

beforeEach(() => {
  window.localStorage.clear();
});

describe("ruleConfig persistence", () => {
  it("returns an empty map when nothing has ever been saved", () => {
    expect(loadRuleConfig()).toEqual({});
  });

  it("round-trips a saved configuration exactly", () => {
    saveRuleConfig({ "brute-force": false, "usb-device": true });
    expect(loadRuleConfig()).toEqual({ "brute-force": false, "usb-device": true });
  });

  it("returns an empty map when the stored value is corrupt JSON (never throws)", () => {
    window.localStorage.setItem("dfir-workbench:detection:rule-config", "{not valid json");
    expect(() => loadRuleConfig()).not.toThrow();
    expect(loadRuleConfig()).toEqual({});
  });

  it("returns an empty map when the stored value is valid JSON but the wrong shape (e.g. an array)", () => {
    window.localStorage.setItem("dfir-workbench:detection:rule-config", JSON.stringify([1, 2, 3]));
    expect(loadRuleConfig()).toEqual({});
  });

  it("drops individual entries whose value isn't a boolean, keeping the rest (one bad entry can't take out the whole map)", () => {
    window.localStorage.setItem(
      "dfir-workbench:detection:rule-config",
      JSON.stringify({ "brute-force": false, "usb-device": "yes", "rdp-logon": 1 }),
    );
    expect(loadRuleConfig()).toEqual({ "brute-force": false });
  });

  it("overwrites a previously saved configuration on the next save", () => {
    saveRuleConfig({ "brute-force": false });
    saveRuleConfig({ "brute-force": true, "rdp-logon": false });
    expect(loadRuleConfig()).toEqual({ "brute-force": true, "rdp-logon": false });
  });
});
