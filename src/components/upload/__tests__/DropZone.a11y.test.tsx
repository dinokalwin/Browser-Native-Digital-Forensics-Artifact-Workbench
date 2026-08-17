// @vitest-environment jsdom
/**
 * Phase 3 — Accessibility Hardening (SDD §21 "Keyboard operability" /
 * §24 item 6). `DropZone` is the upload workflow's entry point — a
 * drag-and-drop surface that must also be a fully keyboard-operable
 * button (`role="button"`, `tabIndex={0}`, Enter/Space activation — see
 * the component's own implementation), not just a mouse target.
 */
import "@/test/a11y-setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "jest-axe";
import { DropZone } from "../DropZone";
import { useEvidenceStore } from "@/store/evidenceStore";

function renderDropZone() {
  return render(
    <MemoryRouter>
      <DropZone />
    </MemoryRouter>,
  );
}

describe("DropZone accessibility", () => {
  it("has no axe violations in its idle (no file loaded) state", async () => {
    useEvidenceStore.getState().reset();
    const { container } = renderDropZone();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("exposes the drop surface as a keyboard-operable, labeled button", () => {
    useEvidenceStore.getState().reset();
    renderDropZone();
    const dropSurface = screen.getByRole("button", { name: /upload evtx file or files/i });
    expect(dropSurface).toHaveAttribute("tabIndex", "0");
  });

  it("marks the decorative 'Select File' control and icons as hidden from assistive tech, avoiding a duplicate announced control", () => {
    useEvidenceStore.getState().reset();
    renderDropZone();
    // Rendered as a `span` (via `Button asChild`), not a native `<button>` —
    // a nested native button inside the outer `role="button"` card is an
    // axe nested-interactive violation regardless of aria-hidden/tabIndex.
    const selectFileControl = screen.getByText(/select file/i);
    expect(selectFileControl.closest("button")).toBeNull();
    expect(selectFileControl).toHaveAttribute("aria-hidden", "true");
  });
});
