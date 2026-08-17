/**
 * Phase 3 — Accessibility Hardening. Shared setup for axe-core/DOM
 * component tests ONLY — imported explicitly by the handful of test files
 * that opt into `// @vitest-environment jsdom` (see those files' own
 * top-of-file comment), never wired into `vitest.config.ts`'s global
 * `setupFiles`. That's deliberate: `vitest.config.ts` still defaults every
 * test file to `environment: "node"` (see its own doc comment), which is
 * what the existing 171 Phase 2 tests run under — importing jest-dom/
 * jest-axe globally would risk those tests touching `window`/`document`
 * globals that don't exist in a plain Node environment. Confining this
 * setup to an explicit per-file import keeps Phase 2's suite completely
 * untouched.
 *
 * `afterEach(cleanup)` is required here rather than relied upon implicitly:
 * `@testing-library/react` normally self-registers its post-test DOM
 * cleanup by detecting the test runner's global `afterEach`, but this
 * project's `vitest.config.ts` sets `globals: false` (a deliberate,
 * unrelated Phase 2 choice — see that file's comment), so the implicit
 * globals RTL looks for are never installed and its auto-cleanup never
 * fires. Without this, every `render()` in a file accumulates in
 * `document.body` across `it()` blocks instead of unmounting between them.
 *
 * `ResizeObserver` (Phase 5 — Raw XML Drill-Down): jsdom doesn't implement
 * it at all. `@tanstack/react-virtual` (Phase 4) already guards for its
 * absence (`if (!targetWindow.ResizeObserver) return`), but Radix's
 * `ScrollArea` — used by `EventDetailsDrawer`, the first component test to
 * render it — calls `new ResizeObserver(...)` unconditionally in a layout
 * effect, throwing a bare `ReferenceError` the moment it mounts in jsdom.
 * A minimal no-op stub is sufficient here: these tests assert on rendered
 * content and interaction, never on live resize-driven scrollbar geometry.
 */
import { afterEach, expect, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);
afterEach(cleanup);

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
