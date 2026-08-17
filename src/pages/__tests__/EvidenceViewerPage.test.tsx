// @vitest-environment jsdom
/**
 * Phase 5 Item 1 — Raw XML Drill-Down. Before this phase, `EvidenceViewerPage`
 * rendered `EvidenceTable` with no `onRowClick` and no `EventDetailsDrawer`
 * at all — a row click here did nothing visible, so the Evidence Viewer
 * (one of SDD §21's three named core workflows) had no way to reach a
 * single event's detail, including its raw XML. This file covers the fix:
 * wiring the same `EventDetailsDrawer` pattern `DashboardPage.tsx` already
 * used.
 *
 * `EvidenceTable` itself is mocked to a minimal row-trigger stub here,
 * deliberately: this test verifies the *wiring* this phase added (does a
 * row click open the drawer with the right event, including its raw XML),
 * not Phase 4's row-virtualization rendering, which has its own coverage
 * and isn't what changed in this phase. The real `EvidenceTable` continues
 * to be exercised via the app's TypeScript/build/lint checks and Phase 4's
 * own verification — this file isolates one concern per the project's
 * existing "test at a clean boundary" convention (see e.g. `parser.test.ts`
 * mocking `@ts-evtx/core`'s binary layer rather than requiring real files).
 *
 * The fixture event is built inside `vi.hoisted` because `vi.mock`'s
 * factory is hoisted above every module-level statement (including plain
 * `const` declarations) — a factory that closed over an ordinary top-level
 * `const` would hit a temporal-dead-zone error at import time.
 */
import "@/test/a11y-setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type { EvtxEvent } from "@/types/evidence";
import { useEvidenceStore } from "@/store/evidenceStore";

const { FIXTURE_EVENT, REPRESENTATIVE_XML } = vi.hoisted(() => {
  const REPRESENTATIVE_XML = "<Event><System><EventID>4624</EventID></System></Event>";
  const FIXTURE_EVENT = {
    id: "evt-1",
    timestamp: "2026-01-01T12:00:00.000Z",
    eventId: 4624,
    provider: "Microsoft-Windows-Security-Auditing",
    computer: "WORKSTATION1",
    user: "jsmith",
    level: "Information",
    channel: "Security",
    message: "TargetUserName: jsmith",
    raw: { xml: REPRESENTATIVE_XML },
  };
  return { FIXTURE_EVENT, REPRESENTATIVE_XML };
});

vi.mock("@/components/evidence/EvidenceTable", () => ({
  EvidenceTable: ({ onRowClick }: { onRowClick?: (event: EvtxEvent) => void }) => (
    <button type="button" onClick={() => onRowClick?.(FIXTURE_EVENT as EvtxEvent)}>
      row-trigger
    </button>
  ),
}));

import EvidenceViewerPage from "../EvidenceViewerPage";

function seedReadyCase() {
  useEvidenceStore.setState({
    uploadedFile: { name: "case.evtx", sizeBytes: 4096, uploadedAt: new Date().toISOString() },
    status: "ready",
    events: [FIXTURE_EVENT as EvtxEvent],
    error: null,
  });
}

describe("EvidenceViewerPage — Raw XML Drill-Down wiring", () => {
  it("opens EventDetailsDrawer with the clicked event's raw XML available", async () => {
    seedReadyCase();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <EvidenceViewerPage />
      </MemoryRouter>,
    );

    // No drawer content until a row is clicked (existing behavior for an
    // as-yet-unopened drawer is preserved).
    expect(screen.queryByRole("heading", { name: "Event 4624" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "row-trigger" }));

    expect(screen.getByRole("heading", { name: "Event 4624" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /raw xml/i }));
    // Scoped to `<pre>` specifically — see EventDetailsDrawer.test.tsx for
    // why an unscoped `textContent` matcher over-matches ancestor nodes.
    expect(
      screen.getByText(
        (_, node) =>
          node?.tagName.toLowerCase() === "pre" && node.textContent === REPRESENTATIVE_XML,
      ),
    ).toBeInTheDocument();
  });

  it("still shows the upload-prompt empty state when no case is loaded (existing behavior preserved)", () => {
    useEvidenceStore.getState().reset();

    render(
      <MemoryRouter>
        <EvidenceViewerPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "No case loaded" })).toBeInTheDocument();
  });
});
