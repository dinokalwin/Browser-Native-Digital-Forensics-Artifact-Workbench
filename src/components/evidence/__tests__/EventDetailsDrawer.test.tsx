// @vitest-environment jsdom
/**
 * Phase 5 Item 1 — Raw XML Drill-Down. `EventDetailsDrawer` already reads
 * `EvtxEvent.raw` (an opaque `unknown`, populated at the parser boundary —
 * see `record-mapper.ts#xmlToEvent`, covered separately in
 * `record-mapper.test.ts`) and renders it in a collapsible "Raw XML"
 * section, distinct from the parsed/normalized fields above it. This file
 * is the first automated coverage of that section: it had none before this
 * phase, despite the feature already being fully built.
 *
 * `IOCDetailsSection`/`EventNoteSection`/`BookmarkToggleButton` (rendered
 * as children of the drawer) all read Zustand stores defensively and
 * render nothing/no-op on missing data (see their own source), so no store
 * seeding is required beyond wrapping in `MemoryRouter` for
 * `IOCDetailsSection`'s `useNavigate()`.
 */
import "@/test/a11y-setup";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type { EvtxEvent } from "@/types/evidence";
import { EventDetailsDrawer } from "../EventDetailsDrawer";

/**
 * `@testing-library/user-event`'s own `setup()` installs its own
 * `navigator.clipboard` stub (it needs one internally for `user.copy()`/
 * `user.paste()` support), so a clipboard stub installed BEFORE `setup()`
 * — e.g. at module scope — gets silently clobbered the moment a test calls
 * `userEvent.setup()`. Must be (re)installed AFTER `setup()`, per test.
 */
function stubClipboard(): ReturnType<typeof vi.fn> {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    configurable: true,
    writable: true,
  });
  return writeTextMock;
}

const REPRESENTATIVE_XML = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
  <System>
    <Provider Name="Microsoft-Windows-Security-Auditing"/>
    <EventID>4624</EventID>
  </System>
</Event>`;

function makeEvent(overrides: Partial<EvtxEvent> = {}): EvtxEvent {
  return {
    id: "evt-1",
    timestamp: "2026-01-01T12:00:00.000Z",
    eventId: 4624,
    provider: "Microsoft-Windows-Security-Auditing",
    computer: "WORKSTATION1",
    user: "jsmith",
    level: "Information",
    channel: "Security",
    message: "TargetUserName: jsmith | LogonType: 10",
    ...overrides,
  };
}

function renderDrawer(event: EvtxEvent) {
  return render(
    <MemoryRouter>
      <EventDetailsDrawer selectedEvent={event} open onClose={vi.fn()} caseId={null} />
    </MemoryRouter>,
  );
}

describe("EventDetailsDrawer — Raw XML Drill-Down", () => {
  it("preserves the existing parsed-detail UI (Event ID, Provider, Message) unchanged", () => {
    renderDrawer(makeEvent({ raw: { xml: REPRESENTATIVE_XML } }));
    expect(screen.getByRole("heading", { name: "Event 4624" })).toBeInTheDocument();
    // "Microsoft-Windows-Security-Auditing" legitimately appears twice —
    // once in the Sheet's description line, once in the General
    // Information Provider row — so this asserts presence, not a single
    // match.
    expect(screen.getAllByText("Microsoft-Windows-Security-Auditing").length).toBeGreaterThan(0);
    expect(screen.getByText(/TargetUserName: jsmith/)).toBeInTheDocument();
  });

  it("reveals the raw XML, preserved verbatim, when the toggle is activated and the event has raw XML", async () => {
    const user = userEvent.setup();
    const writeTextMock = stubClipboard();
    renderDrawer(makeEvent({ raw: { xml: REPRESENTATIVE_XML } }));

    // Collapsed by default.
    expect(screen.queryByText(REPRESENTATIVE_XML)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /raw xml/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Rendered verbatim (not reformatted/trimmed) inside a scrollable block.
    // The custom matcher is scoped to `<pre>` specifically — a plain
    // `textContent === ...` matcher would also match every single-child
    // ancestor of the `<pre>` (same textContent propagates upward), which
    // `getByText` then reports as multiple matches.
    const xmlBlock = screen.getByText(
      (_, node) => node?.tagName.toLowerCase() === "pre" && node.textContent === REPRESENTATIVE_XML,
    );
    expect(xmlBlock.closest("div")).toHaveClass("overflow-auto");

    const copyXmlButton = screen.getByRole("button", { name: /copy xml/i });
    expect(copyXmlButton).toBeEnabled();
    await user.click(copyXmlButton);
    expect(writeTextMock).toHaveBeenCalledWith(REPRESENTATIVE_XML);
  });

  it("shows the unavailable state and disables Copy XML when the event has no raw XML", async () => {
    const user = userEvent.setup();
    renderDrawer(makeEvent({ raw: undefined }));

    const toggle = screen.getByRole("button", { name: /raw xml/i });
    await user.click(toggle);

    expect(screen.getByText("No raw XML available for this event.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy xml/i })).toBeDisabled();
  });

  it("shows the unavailable state when `raw` is present but doesn't carry a usable `xml` string (defensive narrowing)", async () => {
    const user = userEvent.setup();
    // `raw` is `unknown` at the type boundary — exercise the narrowing
    // guard against shapes other than the documented `{ xml: string }`.
    renderDrawer(makeEvent({ raw: { notXml: 123 } }));

    const toggle = screen.getByRole("button", { name: /raw xml/i });
    await user.click(toggle);

    expect(screen.getByText("No raw XML available for this event.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy xml/i })).toBeDisabled();
  });

  it("does not render any drawer content when no event is selected (existing behavior preserved)", () => {
    render(
      <MemoryRouter>
        <EventDetailsDrawer selectedEvent={null} open onClose={vi.fn()} caseId={null} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/raw xml/i)).not.toBeInTheDocument();
  });

  it("collapses the raw XML section again when a different event is selected", async () => {
    const user = userEvent.setup();
    const eventA = makeEvent({ id: "evt-a", raw: { xml: REPRESENTATIVE_XML } });
    const eventB = makeEvent({ id: "evt-b", eventId: 4625, raw: { xml: REPRESENTATIVE_XML } });

    const { rerender } = render(
      <MemoryRouter>
        <EventDetailsDrawer selectedEvent={eventA} open onClose={vi.fn()} caseId={null} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /raw xml/i }));
    expect(screen.getByRole("button", { name: /raw xml/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    rerender(
      <MemoryRouter>
        <EventDetailsDrawer selectedEvent={eventB} open onClose={vi.fn()} caseId={null} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /raw xml/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
