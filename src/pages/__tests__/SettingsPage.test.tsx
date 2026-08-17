// @vitest-environment jsdom
/**
 * Phase 5 Item 2 — Configurable Rule Set. Covers the Settings page's UI
 * wiring to `ruleConfigStore`: every registered rule renders with a
 * checkbox reflecting its enabled state, toggling one persists through
 * `lib/detection/ruleConfig.ts` (localStorage), and "Reset to Defaults"
 * restores every rule to enabled. `ruleConfigStore` is a module-level
 * singleton (like every Zustand store in this project), so each test
 * resets both its in-memory state and `localStorage` first — same
 * approach as `store/__tests__/ruleConfigStore.test.ts`.
 */
import "@/test/a11y-setup";
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getAllRules } from "@/lib/detection/registry";
import { loadRuleConfig } from "@/lib/detection/ruleConfig";
import { useRuleConfigStore } from "@/store/ruleConfigStore";
import SettingsPage from "../SettingsPage";

const ALL_RULES = getAllRules();

function resetStore() {
  window.localStorage.clear();
  const enabledByRuleId: Record<string, boolean> = {};
  for (const rule of ALL_RULES) enabledByRuleId[rule.id] = true;
  useRuleConfigStore.setState({ enabledByRuleId, hydrated: true });
}

beforeEach(() => {
  resetStore();
});

describe("SettingsPage — Detection Rules configuration", () => {
  it("renders every registered rule with a checked checkbox and an Enabled badge by default", () => {
    render(<SettingsPage />);

    for (const rule of ALL_RULES) {
      const checkbox = screen.getByRole("checkbox", { name: rule.name });
      expect(checkbox).toBeChecked();
    }
    expect(
      screen.getByText(`${ALL_RULES.length} of ${ALL_RULES.length} rules enabled.`, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Enabled")).toHaveLength(ALL_RULES.length);
  });

  it("unchecking a rule's checkbox disables it: updates the store, the badge, the count, and persists to localStorage", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const bruteForceRule = ALL_RULES.find((r) => r.id === "brute-force");
    if (!bruteForceRule) throw new Error("brute-force rule not found in registry");

    const checkbox = screen.getByRole("checkbox", { name: bruteForceRule.name });
    await user.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(useRuleConfigStore.getState().enabledByRuleId["brute-force"]).toBe(false);
    expect(loadRuleConfig()["brute-force"]).toBe(false);
    expect(
      screen.getByText(`${ALL_RULES.length - 1} of ${ALL_RULES.length} rules enabled.`, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Disabled")).toHaveLength(1);
  });

  it("re-checking a disabled rule's checkbox re-enables it", async () => {
    const user = userEvent.setup();
    useRuleConfigStore.getState().setRuleEnabled("brute-force", false);
    render(<SettingsPage />);

    const bruteForceRule = ALL_RULES.find((r) => r.id === "brute-force");
    if (!bruteForceRule) throw new Error("brute-force rule not found in registry");
    const checkbox = screen.getByRole("checkbox", { name: bruteForceRule.name });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(loadRuleConfig()["brute-force"]).toBe(true);
  });

  it('"Reset to Defaults" restores every rule to enabled and persists it', async () => {
    const user = userEvent.setup();
    useRuleConfigStore.getState().setRuleEnabled("brute-force", false);
    useRuleConfigStore.getState().setRuleEnabled("usb-device", false);
    render(<SettingsPage />);

    expect(screen.getAllByText("Disabled")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Reset to Defaults" }));

    for (const rule of ALL_RULES) {
      expect(screen.getByRole("checkbox", { name: rule.name })).toBeChecked();
    }
    expect(screen.getAllByText("Enabled")).toHaveLength(ALL_RULES.length);
    const stored = loadRuleConfig();
    for (const rule of ALL_RULES) expect(stored[rule.id]).toBe(true);
  });
});
