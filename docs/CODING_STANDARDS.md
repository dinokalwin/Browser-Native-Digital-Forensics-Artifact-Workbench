# Coding Standards — DFIR Workbench

These standards codify the conventions already established in the existing codebase. They apply to all new code from Phase 1 onward. This document describes and locks in the existing standard — it is not a mandate to rewrite already-conforming code.

## Guiding Principles

These priorities guide all implementation decisions throughout the project. Where two of the standards below appear to conflict in a specific case, resolve in this order:

1. **Functional Correctness** — every feature must satisfy the project requirements before optimization or enhancement.
2. **Browser-Only Architecture** — all parsing and processing must execute entirely in the browser. No backend services, no Node.js APIs.
3. **Maintainability** — prefer clean, modular, reusable code over quick fixes.
4. **Type Safety** — use strict TypeScript; avoid `any` unless there is a documented and justified exception.
5. **Performance** — optimize for responsive handling of large EVTX files while keeping the UI smooth.
6. **Accessibility** — follow semantic HTML and accessible component practices using shadcn/ui and Radix.
7. **Testability** — each phase must leave the application buildable and verifiable.
8. **Documentation** — update project documentation whenever architecture or behavior changes.
9. **Preserve Existing Functionality** — do not break existing working features while implementing new ones.
10. **Incremental Development** — implement and complete one approved phase at a time before moving to the next.

## React Standards

- Function components only, using hooks. The sole exception is `ErrorBoundary` (`src/components/feedback/ErrorBoundary.tsx`), which must remain a class component — React only supports error boundaries via the class `componentDidCatch`/`getDerivedStateFromError` lifecycle; there is no hook equivalent.
- Components should be usable with no required props, or must explicitly document why a prop is mandatory.
- Route-level pages are the only components lazy-loaded via `React.lazy()`; feature components within a page are statically imported by that page.
- Side effects (data loading, subscriptions) live in `useEffect` or are delegated to a Zustand store action — never performed directly in the render body.
- Derived UI state (e.g. whether a button should be disabled) is computed inline from store/prop state, not duplicated into local `useState`.
- Cross-cutting structural logic shared by multiple pages (e.g. the no-case / parsing / error / ready branching used by every case-dependent page) is extracted into a shared component — see `CaseStateGate` — rather than duplicated per page.

## TypeScript Standards

- `strict: true` in `tsconfig.json` is non-negotiable, along with `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- `any` is disallowed. Use `unknown` for genuinely opaque data (see `EvtxEvent.raw`) and narrow it explicitly before use.
- Prefer `interface` for object/entity shapes (`EvtxEvent`, `SuspiciousFinding`, `RiskScore`); prefer `type` for unions, intersections, and function signatures (`EventLevel`, `LoadStatus`, `ExportFormat`).
- Exported functions have explicit return types; inference is acceptable for local/private helpers.
- Non-null assertions (`!`) require an inline comment explaining why the value is guaranteed non-null at that point (see the sliding-window logic in `suspicious-detection.ts` / `filterStore.ts` for the existing pattern).
- Domain types live in `src/types/` and are the single source of truth shared across the parsing engine, the analysis engine, and the UI — never redefine a shape locally that already exists there.

## Folder Conventions

Mirrors SDD Section 12 exactly:

```
pages/        route-level pages
layouts/       route shells (AppShell)
routes/         route table
components/    ui/, layout/, landing/, upload/, evidence/, dashboard/, timeline/, theme/, feedback/
store/          one Zustand store per concern (evidence, filter, ui)
services/       the single UI-facing API surface (evtxApi.ts)
backend/        analysis engine — parser, detection, scoring, summary, export — framework-free
types/           shared domain types
hooks/           cross-cutting React hooks
lib/ / utils/    small, framework-free helpers
```

Hard rule: **only `src/services/evtxApi.ts` imports from `src/backend/`.** No page or component imports a `backend/*` module directly. This is what keeps the analysis engine swappable (SDD §11) without UI-layer changes.

## Component Conventions

- One component per file; the file's default export is the component named by the file.
- Feature-level components (page sections, panels, tables) use PascalCase filenames matching the component name: `EvidenceTable.tsx`, `RiskScoreCard.tsx`, `CaseStateGate.tsx`.
- shadcn/ui primitives (`components/ui/`) and small, single-purpose helper modules keep shadcn's own generator convention of lowercase-kebab-case filenames: `button.tsx`, `dropdown-menu.tsx`, `theme-provider.tsx`, `level-badge.tsx`. This PascalCase-for-feature-components / kebab-case-for-primitives-and-helpers split is intentional and preserved as-is — do not rename existing files to "unify" it.
- Props types are named `<ComponentName>Props` and declared immediately above the component in the same file.
- A component that only makes sense composed with a sibling (e.g. `SummaryCards` + `StatCard`) lives in the same feature folder, not split across folders.

## Naming Conventions

- Components, types, and interfaces: `PascalCase`.
- Variables, functions, hooks: `camelCase` (hooks additionally prefixed `use`, e.g. `useEvidenceStore`).
- True constants (module-level, never reassigned, semantically fixed): `SCREAMING_SNAKE_CASE` (e.g. `MIN_FILE_SIZE`, `DEFAULT_TIMEOUT_MS`).
- Zustand store hooks: `use<Domain>Store` (`useEvidenceStore`, `useFilterStore`, `useUIStore`); selectors exported alongside as `select<Thing>` (`selectEvents`, `selectStatus`, `selectIsLoading`).
- Files: see Component Conventions above for the PascalCase/kebab-case split; non-component TypeScript files (stores, services, most utils) use camelCase (`evidenceStore.ts`, `worker-client.ts` being a documented kebab-case exception already in use in `backend/engine/`).

## Import Conventions

- All intra-`src` imports use the `@/` path alias (`@/store/evidenceStore`), never deep relative paths (`../../../store/evidenceStore`).
- Import order: external packages first, then `@/*` absolute imports, then same-directory relative imports — a blank line between each group.
- Type-only imports use `import type { ... }` to keep runtime bundles free of type-only re-exports.
- Dynamic `import()` is reserved for deliberate code-splitting boundaries (route-level pages, and the backend module loaded on first file upload) — it is not used as a substitute for normal imports elsewhere.
