// @vitest-environment jsdom
/**
 * Phase 3 — Accessibility Hardening (SDD §24 item 6). `LevelBadge` is this
 * app's smallest representative of §21's "color is never the only signal"
 * requirement (see `LevelBadge`'s own `LEVEL_VARIANT` map, which pairs a
 * color-coded `Badge` variant with the level's own text label) — an axe
 * scan gives that requirement automated, not just eyeballed, verification.
 */
import "@/test/a11y-setup";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { LevelBadge } from "../level-badge";

describe("LevelBadge accessibility", () => {
  it.each(["Critical", "Error", "Warning", "Information", "Verbose"] as const)(
    "has no axe violations for level '%s'",
    async (level) => {
      const { container } = render(<LevelBadge level={level} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
  );

  it("always renders the level as visible text, not just a color", () => {
    const { getByText } = render(<LevelBadge level="Critical" />);
    expect(getByText("Critical")).toBeInTheDocument();
  });
});
