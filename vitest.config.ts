import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * Phase 2 — Automated Test Foundation.
 *
 * `mergeConfig` layers this file's `test` block on top of the project's
 * existing `vite.config.ts` (the `@` alias and the `process.env.EVTX_DEBUG`
 * define both apply identically under test) rather than duplicating either
 * — matching this project's standing "no duplicate logic" rule.
 *
 * `environment: "node"` (not "jsdom") stays the DEFAULT for every Phase 2
 * test (SDD §24 items 1-4 — parser, detection rules, risk-score, store):
 * all framework-free/pure or Zustand-store logic, none of it touching the
 * DOM. Phase 3 (SDD §24 item 5/6 — component + axe-core accessibility
 * checks) opts individual `.test.tsx` files INTO jsdom per-file, via a
 * `// @vitest-environment jsdom` docblock at the top of just those files
 * (see `src/test/a11y-setup.ts`) — the global default here is deliberately
 * left unchanged so the 171 existing Phase 2 tests keep running exactly as
 * before, with zero risk of a jsdom global leaking into a pure-logic test.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      globals: false,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: [
          "src/lib/detection/**/*.ts",
          "src/backend/engine/record-mapper.ts",
          "src/backend/engine/parser.ts",
          "src/backend/risk-score.ts",
          "src/store/evidenceStore.ts",
        ],
      },
    },
  }),
);
