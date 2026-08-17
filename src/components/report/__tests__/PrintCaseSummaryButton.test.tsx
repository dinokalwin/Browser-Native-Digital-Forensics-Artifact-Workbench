// @vitest-environment jsdom
/**
 * Phase 5 Item 3 — Printable Case Summary. `PrintCaseSummaryButton` is a
 * thin, stateless trigger — the only behavior worth testing is that it's
 * a properly labeled, keyboard-activatable control that calls
 * `window.print()`, per this phase's "print trigger must be keyboard
 * accessible, appropriately labeled, usable without a mouse" requirement.
 */
import "@/test/a11y-setup";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PrintCaseSummaryButton } from "../PrintCaseSummaryButton";

describe("PrintCaseSummaryButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is exposed as a properly labeled, focusable button control", () => {
    render(<PrintCaseSummaryButton />);
    const button = screen.getByRole("button", { name: "Print case summary" });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
  });

  it("calls window.print() when clicked with a mouse", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<PrintCaseSummaryButton />);

    await user.click(screen.getByRole("button", { name: "Print case summary" }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("calls window.print() when activated from the keyboard (Tab + Enter), with no mouse involved", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<PrintCaseSummaryButton />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Print case summary" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
