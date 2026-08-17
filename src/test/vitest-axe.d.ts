/**
 * Phase 3 — Accessibility Hardening. `@types/jest-axe` only augments
 * Jest's own `Matchers` namespace (`declare global { namespace jest {...} }`
 * / `@jest/expect`), not Vitest's — this project uses Vitest, never Jest,
 * so `expect(...).toHaveNoViolations()` would otherwise fail to typecheck
 * even though `a11y-setup.ts`'s `expect.extend(toHaveNoViolations)` makes
 * it work correctly at runtime. This file only adds the missing TYPE
 * information; `a11y-setup.ts` is what actually registers the matcher.
 */
import "vitest";

interface AxeMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

declare module "vitest" {
  // Declaration merging into Vitest's own `Assertion`/`AsymmetricMatchersContaining`
  // interfaces requires `interface extends`, not a `type` alias — a type
  // alias wouldn't merge with the library's existing declaration. The
  // "empty interface" lint rule doesn't apply to this augmentation pattern.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = unknown> extends AxeMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
