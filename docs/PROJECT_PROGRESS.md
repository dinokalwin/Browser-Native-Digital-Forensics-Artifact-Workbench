# Project Progress — DFIR Workbench

Last updated: 2026-08-17

## Phase numbering note

This document is the authoritative phase ledger going forward. The SDD's Section 25 roadmap (phases 0–12) describes delivery in narrative order; formal phase tracking in this document and `CHANGELOG.md` restarts numbering at **Phase 1** for all work done under the documented process established today. Everything delivered before this documentation framework existed — SDD phases 0 through 7 (scaffolding through worker-based parsing, rule-based detection, and export) — is tracked here as a single completed **Phase 0 — Baseline**.

Mapping between this ledger and the SDD roadmap:

| This ledger | SDD §25 equivalent | Name |
|---|---|---|
| Phase 0 | Phases 0–7 | Baseline (pre-process MVP) |
| Phase 1 | *(new)* | Project Foundation |
| Phase 2 | Phase 8 | Automated Test Foundation |
| Phase 3 | Phase 9 | Accessibility Hardening |
| Phase 4 | Phase 10 | Performance at Scale |
| Phase 5 | Phase 11 | Detection & Reporting Depth |
| Phase 6 | Phase 12 | Stretch Evaluation |

## Current phase

**Phase 5 — Detection & Reporting Depth.** Complete. All three items (Raw XML Drill-Down, Configurable Rule Set, Printable Case Summary) shipped 2026-08-17. Phase 6 — Stretch Evaluation has not been started.

## Completed phases

- **Phase 0 — Baseline** — MVP feature-complete: EVTX parsing (Web Worker–based, resilient to corrupt files), rule-based suspicious-event detection, risk scoring, investigation summary, dashboard, evidence viewer, timeline, CSV/JSON export, dark/light theme, responsive layout, static-site deployment config.
- **Phase 1 — Project Foundation / Architecture & Foundation Hardening** — completed 2026-07-31. ESLint 9 (flat config) + Prettier baseline, GitHub Actions CI, pinned Node version, `.env.example`, two safe strict-TypeScript additions (`verbatimModuleSyntax`, `noImplicitOverride`), removal of one dead file (`mock-events.ts`, neutralized — see Known Constraints below) and one unused duplicate export (`evtx-parser.ts`'s orphaned `parseEVTXBuffer`), and a repo-wide Prettier formatting pass (33 files, whitespace/formatting-only, verified behavior-identical via typecheck/lint/build before and after). Zero visible functionality changed; zero parser logic touched. See `CHANGELOG.md` for the full breakdown and the conversation's Phase 1 report for before/after detail.
- **Phase 2 — Automated Test Foundation** — completed 2026-08-14, extended 2026-08-17. Vitest (+ `@vitest/coverage-v8`) stood up per SDD §24 items 1-4: parser unit tests (`record-mapper.ts#xmlToEvent` against crafted XML/stub records; `parser.ts#parseEVTXBuffer`'s resilience control-flow against a mocked `@ts-evtx/core`), one test file per detection rule (all 14 rules in `lib/detection/rules/`, run through the real `runDetectionEngine`), exhaustive `backend/risk-score.ts#computeRiskScore` tests, and `evidenceStore.loadFiles` branching tests — 91 tests/18 files at initial completion. Extended the same day the ledger's Phase 3 kickoff began: full coverage of `src/lib/detection/context/*` (`contextScoring.ts`, `pathContext.ts`, `vendorContext.ts`, `serviceContext.ts`) — the Phase 5.13/5.13.1 confidence model, correlation-suppression fix, and kernel-mode-driver signal — including end-to-end `evidenceSignals`/threat-scoring tests via the real detection engine and regression tests for the correlation-suppression fix. **171 tests across 22 files, all passing** (final count after the extension). Component/interaction tests (SDD §24 item 5) and axe-core accessibility checks (item 6) were deferred to Phase 3. CI (`ci.yml`) runs `npm run test` between `format:check` and `build`. See `CHANGELOG.md` [0.1.3] and [0.1.4] for the full file lists.
- **Phase 3 — Accessibility Hardening** — completed 2026-08-17. Audited against SDD §21; found 4 of 7 requirements already satisfied (skip link, semantic table structure, color-never-only-signal, keyboard operability of Radix-based menus/dialogs) and 3 incomplete, all three closed out: reduced motion via framer-motion's own `<MotionConfig reducedMotion="user">` at the app root (zero new dependencies, zero per-component changes); route-change focus management on `AppShell`'s `<main>` landmark (standard React Router SPA pattern); automated axe-core checks added to the Vitest suite via `jest-axe` + React Testing Library, scoped to `jsdom` per-file (`// @vitest-environment jsdom`) so the existing 171 node-environment tests are untouched. The axe scan itself caught a real, previously-unknown defect — `DropZone` nested two native interactive elements (a decorative button, a hidden file input) inside its own `role="button"` drop surface — fixed with no visual or interaction change. **185 tests across 26 files, all passing** (14 new). See `CHANGELOG.md` [0.1.5] for the full breakdown.
- **Phase 4 — Performance at Scale** — completed 2026-08-17. Per the roadmap's "evaluate and, if warranted, implement": confirmed `EvidenceTable`'s existing pagination (max page size 100) already bounds mounted DOM rows regardless of total event count, so the SDD's literal "100k+ row DOM overhead" scenario doesn't currently manifest — implemented row virtualization anyway (via `@tanstack/react-virtual`, the official TanStack Table pairing) since the roadmap names the evidence table as the explicit target and it's a real, if modest today, DOM-node reduction that also unlocks safely raising the page-size cap later. Zero changes to sorting/filtering/selection/pagination state or `<table>` semantics — virtualization is scoped purely to which already-computed rows get mounted. Added parser throughput benchmarks (`parser.bench.ts`, `record-mapper.bench.ts`) using Vitest's built-in `bench()` API (no new dependency) — measured `parseEVTXBuffer`'s own control flow at ~300k synthetic records/sec and `xmlToEvent`'s real per-record XML-mapping cost at ~18k records/sec, honestly scoped to project-owned code (not the vendored `@ts-evtx/core` binary decoder, for which no deterministic large fixture exists). Preserved the full 185-test baseline; zero detection/scoring logic touched. See `CHANGELOG.md` [0.1.6] for full numbers and the conversation's Phase 4 report.

### Phase 5 — Detection & Reporting Depth (complete)

- **Item 1 — Raw XML Drill-Down** — completed 2026-08-17. Investigated before implementing, per process: the data model (`EvtxEvent.raw`, populated at `record-mapper.ts`'s parser boundary) and the UI (`EventDetailsDrawer`'s collapsible, scrollable, copy-enabled "Raw XML" section with a correct empty state) already existed, predating this ledger's phase tracking. The actual gap was that `EvidenceViewerPage` — a named SDD §21 core workflow — never wired up `EventDetailsDrawer` at all, so it had no way to reach any event detail, raw XML included; fixed by reusing `DashboardPage`'s existing local-state pattern for the same drawer. Also fixed a jsdom test-infrastructure gap discovered along the way (Radix `ScrollArea` needs `ResizeObserver`, which jsdom doesn't provide — added a no-op stub to `src/test/a11y-setup.ts`). 194 tests across 30 files, all passing (9 new). See `CHANGELOG.md` [0.1.7] for the full breakdown.
- **Item 2 — Configurable/extensible detection rule set** — completed 2026-08-17. Investigated before implementing: no configuration infrastructure existed; the project's established `lib/*/storage.ts` + Zustand-store local-persistence pattern (from `lib/cases/storage.ts`/`caseStore.ts`) was reused rather than inventing a new one. New pure `lib/detection/ruleConfig.ts` (localStorage, defensive parsing) + `store/ruleConfigStore.ts` (reactive layer, safe "enabled by default" fallback) hold only a `Record<ruleId, boolean>` participation map keyed by each rule's own existing `id` — no rule semantics duplicated or altered. `runDetectionEngine` gained an optional `enabledRuleIds` second parameter (every existing call site omits it and is unaffected); a disabled rule's `run()` is simply never invoked, so it produces zero findings rather than being filtered afterward. New `SettingsPage` at `/dashboard/settings` (added to nav exactly where two prior sprint comments anticipated it) lists every rule with an Enabled/Disabled badge and a checkbox (reusing the existing `Checkbox` primitive), plus "Reset to Defaults"; deliberately not wrapped in `CaseStateGate`, matching `CasesPage.tsx`'s precedent for cross-case preference pages. Toggling a rule takes effect on the next file load, not retroactively on an already-open case — an explicit, documented scope decision. 227 tests across 32 files, all passing (33 new). See `CHANGELOG.md` [0.1.8] for the full breakdown.
- **Item 3 — Printable/exportable case summary** — completed 2026-08-17. Investigated before implementing: an exhaustive, unbounded multi-page PDF "Investigation Report" already existed (`lib/report.ts` + `services/report/pdfGenerator.ts`), but the SDD describes this item differently — "formatted single-page report of the dashboard view" — and no print CSS existed anywhere in the project. Implemented as a deliberately separate, much smaller artifact rather than extending or duplicating the PDF pipeline: `CaseSummaryPrintView` (pure, presentation-only, reuses `RiskScoreCard`'s `countBySeverity` and props `DashboardPage` already computes — no new aggregation or store reads) renders a condensed one-page summary (case metadata, threat score, severity breakdown, investigation summary, top 8 findings), shown only via `hidden print:block`; a new `PrintCaseSummaryButton` triggers the browser's native `window.print()` — no new PDF library. `Navbar`/`Sidebar`/`MobileSidebar` gained `print:hidden`; `index.css` gained a small `@media print` block for page margins and a forced light background. 237 tests across 34 files, all passing (10 new). See `CHANGELOG.md` [0.1.9] for the full breakdown.

## Critical Fix (post-Phase-1, pre-Phase-2)

- **2026-07-31 — EVTX parsing was silently producing zero usable events.** A user-driven manual verification pass (per Phase 1's Manual Verification Checklist) caught this — it could not have been caught by typecheck, lint, or build, since it was a runtime-only failure specific to executing inside a Worker. Root cause: `record-mapper.ts` used `DOMParser`, which is not available in any Worker global scope in any browser. Fixed by switching to `fast-xml-parser`. See `docs/ARCHITECTURE_DECISIONS.md` ADR-010 and `CHANGELOG.md` [0.1.2]. **This revises the "Functional scope: 11/11 delivered = 100%" figure below** — that figure reflected feature/architecture presence, not verified runtime correctness end-to-end with a real file in a real browser. It is accurate again as of this fix, but the gap it was hiding is itself a data point: automated end-to-end coverage (Phase 2) matters more than this ledger previously weighted it.

## Known Constraints

- This project's mounted working directory does not support file deletion (unlink/rename) from the assistant's tooling — confirmed during Phase 1 when removing `src/lib/mock-events.ts`. The established workaround (already used once before, in `src/types/backend-api.d.ts`) is to neutralize the file's content to an empty, documented stub rather than remove it. A contributor with normal local file access can `git rm` these stubs at any time.

## Remaining phases

- Phase 6 — Stretch Evaluation

## Percentage complete

Tracked along two dimensions, because they answer different questions:

- **Functional scope** (SDD §7 Must Have features): 11 / 11 delivered = **100%**
- **Engineering process phases** (this ledger, Phase 1–6): 5 / 6 complete = **83%**
- **Blended project completion** (weighted 60% functional, 40% process — process work being what primarily remains before the project is considered production-hardened): **93%**

This blended figure will be recalculated at the close of every phase per `PHASE_CHECKLIST.md`'s Definition of Done.

## Milestones

| Milestone | Status | Date |
|---|---|---|
| MVP feature-complete | Done | 2026-07-25 (approx., pre-SDD) |
| Software Design Document approved | Done | 2026-07-31 |
| Documentation framework established | Done | 2026-07-31 |
| Phase 1 (Project Foundation / Foundation Hardening) shipped | Done | 2026-07-31 |
| Phase 2 (automated test suite) shipped | Done | 2026-08-14 |
| Phase 3 (accessibility audit passed) | Done | 2026-08-17 |
| Phase 4 (performance benchmarked at scale) | Done | 2026-08-17 |
| v1.0.0 candidate ready for external review | Not started | — |
