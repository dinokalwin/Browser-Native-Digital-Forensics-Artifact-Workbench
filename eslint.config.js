import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * Flat ESLint config (ESLint 9). Scoped to `src/**\/*.{ts,tsx}` — this is a
 * Vite app with no test files or Node-side scripts under `src`, so a single
 * browser-targeted config block covers the whole source tree.
 *
 * Rule severities are deliberately calibrated against the *existing*
 * codebase (Phase 1 is a hardening pass, not a rewrite): anything that
 * would require touching parser/detection logic or generated shadcn/ui
 * primitives to satisfy is set to "warn" with a comment explaining why,
 * rather than "error" — see CODING_STANDARDS.md and PHASE_CHECKLIST.md's
 * guidance on downgrading vs. silently disabling.
 */
export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    settings: {
      react: { version: "18.3" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      // Vite's fast-refresh boundary rule — components-only files may still
      // export non-component constants (e.g. selectors, NAV_ITEMS).
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // React 18 + the classic JSX transform (no `import React` needed).
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off", // TypeScript is the source of truth for prop shapes.

      // NFR-4 / CODING_STANDARDS.md: no `any` without a documented exception.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Non-null assertions are allowed per CODING_STANDARDS.md, but only
      // with an explaining comment — that convention can't be enforced by
      // lint alone, so this stays a warning to keep new occurrences visible
      // in review rather than silently permitted.
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
  {
    // Ambient module-augmentation files (see tanstack-table.d.ts) must
    // redeclare a generic parameter list that matches the upstream
    // interface exactly, even when a given file only uses one of them —
    // that's not an unused variable, it's how declaration merging works.
    files: ["src/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // shadcn/ui primitives (components.json-generated) forward `children`
    // via `{...props}` spread rather than literal JSX children, so
    // jsx-a11y/heading-has-content can't statically prove a heading has
    // content — a false positive against this generator's own pattern,
    // not a real accessibility gap. Every call site supplies real text.
    // Scoped to ui/ only; do not extend this exception elsewhere.
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "jsx-a11y/heading-has-content": "off",
    },
  },
  // Must be last: turns off any core/plugin rule that would conflict with
  // Prettier's formatting output, so ESLint never fights the formatter.
  eslintConfigPrettier,
);
