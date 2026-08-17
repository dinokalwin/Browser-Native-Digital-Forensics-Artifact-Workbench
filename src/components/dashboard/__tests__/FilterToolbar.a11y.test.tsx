// @vitest-environment jsdom
/**
 * Phase 3 — Accessibility Hardening (SDD §21 "Keyboard operability" /
 * §24 item 6). `FilterToolbar` is the dashboard/evidence-review workflow's
 * primary form surface (search box + 4 filter controls) — every field has
 * a paired `<label htmlFor>` (see the component's own `FilterField`
 * wrapper), which is exactly what an axe scan verifies mechanically.
 */
import "@/test/a11y-setup";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { FilterToolbar } from "../FilterToolbar";
import type { InvestigationFilters } from "@/lib/eventFilters";

const EMPTY_FILTERS: InvestigationFilters = {
  search: "",
  provider: null,
  computer: null,
  eventId: null,
  level: "All",
  sourceFile: null,
};

describe("FilterToolbar accessibility", () => {
  it("has no axe violations in its default state", async () => {
    const { container } = render(
      <FilterToolbar
        filters={EMPTY_FILTERS}
        onFiltersChange={vi.fn()}
        providers={["Microsoft-Windows-Security-Auditing"]}
        computers={["WORKSTATION1"]}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations with active filters and the multi-source dropdown shown", async () => {
    const activeFilters: InvestigationFilters = {
      ...EMPTY_FILTERS,
      search: "logon",
      provider: "Microsoft-Windows-Security-Auditing",
      level: "Critical",
    };
    const { container } = render(
      <FilterToolbar
        filters={activeFilters}
        onFiltersChange={vi.fn()}
        providers={["Microsoft-Windows-Security-Auditing"]}
        computers={["WORKSTATION1", "DC01"]}
        sourceFiles={["System.evtx", "Security.evtx"]}
        bookmarkedOnly={true}
        onBookmarkedOnlyChange={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("every filter field exposes an accessible name via its label", () => {
    const { getByLabelText } = render(
      <FilterToolbar
        filters={EMPTY_FILTERS}
        onFiltersChange={vi.fn()}
        providers={[]}
        computers={[]}
      />,
    );
    expect(getByLabelText(/search events/i)).toBeInTheDocument();
    expect(getByLabelText(/filter by provider/i)).toBeInTheDocument();
    expect(getByLabelText(/filter by computer/i)).toBeInTheDocument();
    expect(getByLabelText(/filter by level/i)).toBeInTheDocument();
  });
});
