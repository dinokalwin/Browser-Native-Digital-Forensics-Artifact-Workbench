# Changelog

All notable changes to DFIR Workbench are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

**Versioning policy while pre-1.0:** `0.MINOR.PATCH`. MINOR bumps for each completed phase that adds functionality; PATCH for fixes or tooling-only changes with no user-facing functionality change. `1.0.0` is reserved for the point at which all SDD §7 Must Have features are delivered *and* the process-hardening phases — automated test suite, accessibility audit, performance benchmark — are complete.

## [Unreleased]

Phase 5 (Detection & Reporting Depth) is now fully complete — all three Nice to Have items shipped.

## [0.1.9] - 2026-08-17

Per this changelog's versioning policy, this is a MINOR bump: adds user-facing functionality (a one-page, print-friendly case summary reachable from the Dashboard).

### Added — Phase 5 Item 3: Printable Case Summary
- **Investigated first, per this project's standing process:** an exhaustive, unbounded multi-page PDF "Investigation Report" already existed (`lib/report.ts#buildReportData` + `services/report/pdfGenerator.ts`, triggered by `GenerateReportButton`) — every finding, bookmark, note, and a full MITRE ATT&CK breakdown. SDD §7 describes this later item differently: "Printable/exportable case summary (**formatted single-page report of the dashboard view**)." No print-specific CSS existed anywhere in the project (`index.css` had no `@media print` rule). Rather than extending the existing PDF generator into a second mode, or building a second PDF pipeline (a new PDF library would have duplicated `jsPDF`, already in use), this item was implemented as a genuinely separate, much smaller artifact: a condensed, single-page, browser-printable summary — matching the SDD's own "single-page report of the dashboard view" wording, which the exhaustive PDF report does not attempt to be.
- **`CaseSummaryPrintView`** (`src/components/report/CaseSummaryPrintView.tsx`, new): a pure, presentation-only component condensing case metadata, threat score, severity breakdown, the investigation summary, and the highest-severity detection findings (capped at 8, with a "+N more — see Evidence Viewer" line) into one page. Every value is a prop already computed by `DashboardPage` (`statistics`, `investigationSummary`, `iocFindings`) — no new aggregation, no new store reads, no recalculated scores. Severity counts reuse `RiskScoreCard`'s own `countBySeverity` (now exported) rather than re-deriving them a second time. Findings arrive already severity-sorted by the unmodified `engine.ts#runDetectionEngine`, so "highest severity first" required no new sorting logic either. Every text color is a fixed gray/black (never the theme-variable `text-foreground`/`bg-background` tokens), so the printed page reads as a plain document regardless of whether dark or light theme was active on screen.
- **`PrintCaseSummaryButton`** (`src/components/report/PrintCaseSummaryButton.tsx`, new): calls the browser's native `window.print()` — no new PDF library, no second export pipeline. The browser's own print dialog already offers "Save as PDF" as a destination, satisfying "printable/exportable" without duplicating the existing PDF generator. A plain `Button`, keyboard-focusable and Enter/Space-activatable for free. Placed next to the existing "Generate Report" button on `DashboardPage`.
- **Print presentation:** `CaseSummaryPrintView` is rendered permanently (`hidden print:block`) rather than mounted only on click, so the browser's print layout engine has real content the instant `window.print()` fires; the rest of `DashboardPage`'s content is wrapped in `print:hidden`. `Navbar`, the desktop `Sidebar`, and `MobileSidebar` all gained `print:hidden` so the app chrome never appears in a printout regardless of which page triggered it. `index.css` gained a small `@media print` block (`@page { margin: 1.5cm }`, forced white background/black body text as a defensive backstop) — deliberately outside any Tailwind `@layer` so it always wins over the themed `body` rule without needing `!important`. Each section uses `break-inside-avoid` to discourage awkward page splits.
- 10 new tests across 2 files: `CaseSummaryPrintView.test.tsx` (7 — renders with a valid case, correct case metadata, correct detection/severity counts sourced from existing findings, existing threat score shown unmodified, safe rendering for an empty/minimal case, no crash on missing optional investigation-summary fields, findings beyond the cap collapse into a "+N more" line without losing the total count) and `PrintCaseSummaryButton.test.tsx` (3 — properly labeled/focusable control, `window.print()` called on click, `window.print()` called on keyboard Tab+Enter activation with no mouse involved).

### Notes
- No detection/scoring/IOC/correlation/vendor/path/service-legitimacy/kernel-driver logic was touched. Phase 5 Item 1 (Raw XML Drill-Down) and Item 2 (Configurable Rule Set) are unaffected — neither `EventDetailsDrawer` nor `ruleConfig.ts`/`ruleConfigStore.ts`/`engine.ts`'s `enabledRuleIds` filtering were modified.
- The existing "Generate Report" PDF (`GenerateReportButton`) is untouched — this item did not rewrite, extend, or duplicate it. The two features now serve different purposes: an exhaustive multi-page PDF for the full case record, and a single-page printable snapshot of the Dashboard.
- **Phase 5 — Detection & Reporting Depth is now COMPLETE**: all three Nice to Have items (Raw XML Drill-Down, Configurable Rule Set, Printable Case Summary) shipped.

## [0.1.8] - 2026-08-17

Per this changelog's versioning policy, this is a MINOR bump: adds user-facing functionality (a Settings page letting analysts enable/disable individual detection rules).

### Added — Phase 5 Item 2: Configurable Rule Set
- **Investigated first, per this project's standing process:** no configuration infrastructure for detection rules existed. `runDetectionEngine` (`src/lib/detection/engine.ts`) always ran every rule returned by `registry.ts#getAllRules()`; there was no settings/preferences page or nav item (though two prior comments in `nav-items.ts`, from Sprint 5.9.1 and Phase 5.11, explicitly anticipated one). The project's established local-persistence pattern — a pure `lib/*/storage.ts` module wrapping `window.localStorage` in try/catch, paired with a Zustand store that hydrates lazily — was identified (via `lib/cases/storage.ts` + `caseStore.ts`) as the pattern to reuse.
- **Configuration model:** `src/lib/detection/ruleConfig.ts` (new) — a pure, defensive `loadRuleConfig()`/`saveRuleConfig()` pair over a single `localStorage` key (`dfir-workbench:detection:rule-config`), storing only a `Record<ruleId, boolean>`. It never throws, drops individual malformed entries rather than discarding the whole map, and holds no rule semantics of its own — it is purely a participation switch, keyed by each rule's own existing `id` from `registry.ts`. No rule's severity, scoring, correlation, vendor-matching, path-classification, service-legitimacy, or kernel-mode-driver logic was touched or duplicated.
- **Reactive store:** `src/store/ruleConfigStore.ts` (new) — mirrors the above via Zustand, defaulting every currently-registered rule to enabled (`?? true` fallback everywhere an id isn't explicitly present), matching this phase's "if never configured, all current rules behave exactly as they currently do" requirement. Exposes `getEnabledRuleIds(): ReadonlySet<string>`, a non-reactive snapshot function (hydrates first, then reads) for use outside React.
- **Detection engine integration:** `runDetectionEngine(events, enabledRuleIds?)` (`engine.ts`) gained a second, optional parameter — every existing call site across the project (every rule/context test file, `testHelpers.ts`, `evidenceStore.ts`'s other paths) omits it and gets the exact previous behavior unchanged. When provided, it is a pure filter on *which rules run at all*: a disabled rule's `run()` is simply never called, producing zero findings, rather than filtering findings after the fact. Nothing about context building or the enrichment/scoring pass is altered for rules that do run. Threaded through unchanged signatures at `backend/index.ts#detectIOCs` and `services/evtxApi.ts#detectIOCs`; `evidenceStore.ts`'s `loadFiles` action now calls `detectIOCs(events, getEnabledRuleIds())`.
- **Settings UI:** `src/pages/SettingsPage.tsx` (new), at `/dashboard/settings`, added to `nav-items.ts` between Timeline and MITRE ATT&CK (exactly where Sprint 5.9.1's own comment anticipated). Lists every registered rule with its name, description, an Enabled/Disabled badge, and a Radix `Checkbox` (the project's existing checkbox primitive — no new `Switch` dependency added) wired to `setRuleEnabled`, plus a "Reset to Defaults" action. Deliberately not wrapped in `CaseStateGate`, matching `CasesPage.tsx`'s own precedent for cross-case, always-available preference pages.
- 33 new tests (227 total across 32 files, up from 194/30): `ruleConfig.test.ts` (6 — persistence round-trip, corrupt/malformed storage handling), `ruleConfigStore.test.ts` (11 — hydration/merge with defaults, idempotent hydrate, stale rule ids ignored, `setRuleEnabled`/`resetToDefaults` persistence, `getEnabledRuleIds` reflecting current and pre-hydration state), `engine.test.ts` (12 — default vs. filtered rule execution, re-inclusion, cross-rule isolation, unknown rule ids safely ignored, identical finding content on the enabled path, kernel-mode-driver/context-scoring regression through both the default and an explicit full-inclusion set), `SettingsPage.test.tsx` (4 — renders every rule's default-enabled state, toggling disables/re-enables and persists, "Reset to Defaults" restores all).

### Notes
- **Scope decision, explicitly out of this item's minimal implementation:** toggling a rule in Settings does not retroactively re-run detection on an already-loaded case — `runDetectionEngine` is invoked once per file load, and reactively recomputing it on every checkbox click was not part of this item's architecture-compatible scope. A toggle takes effect the next time a case/file is loaded; `SettingsPage.tsx`'s own doc comment and its on-page description state this plainly.
- No rule's detection logic, severity, MITRE mapping, confidence/context scoring, correlation-suppression, vendor-matching, path-classification, service-legitimacy, or kernel-mode-driver detection was modified — verified by the full pre-existing 194-test suite continuing to pass unmodified, plus this phase's own regression tests exercising those exact code paths through the new optional parameter.
- Item 3 (printable/exportable case summary) remains unstarted, per explicit instruction.

## [0.1.7] - 2026-08-17

Per this changelog's versioning policy, this is a MINOR bump: adds user-facing functionality (Evidence Viewer now has a detail/raw-XML drill-down it previously lacked entirely).

### Added — Phase 5 Item 1: Raw XML Drill-Down (partial phase — Items 2/3 not started)
- **Investigated first, per this project's standing process:** the data model and UI for this feature already existed. `EvtxEvent.raw` (`src/types/evidence.ts`) has carried an opaque `{ xml: string }` payload since before this ledger's phase tracking began, populated at `record-mapper.ts#xmlToEvent`'s parser boundary (`raw: { xml }`); `EventDetailsDrawer.tsx` already rendered it in a collapsible "Raw XML" section — verbatim, monospace, scrollable (`max-h-80 overflow-auto`), with a working "Copy XML" button and a "No raw XML available for this event." empty state — reached from `DashboardPage`. None of that needed to be built.
- **The actual gap:** `EvidenceViewerPage.tsx` (`/dashboard/evidence`) — one of SDD §21's three named core workflows — rendered `EvidenceTable` with no `onRowClick` and no `EventDetailsDrawer` at all. A row click there did nothing visible; the Evidence Viewer had no way to reach a single event's detail, raw XML included. Fixed by wiring in the same `selectedEvent`/`isDrawerOpen` local-state pattern `DashboardPage.tsx` already established for this exact drawer — strictly additive, no prior behavior to preserve or break on that page.
- **Test infrastructure fix, found while adding this phase's tests:** `EventDetailsDrawer` is the first component test to render Radix `ScrollArea`, which calls `new ResizeObserver(...)` unconditionally in a layout effect — jsdom doesn't implement `ResizeObserver` at all, so every test rendering the drawer threw immediately. `src/test/a11y-setup.ts` now installs a minimal no-op `ResizeObserver` stub when the global is absent, fixing this for every current and future jsdom test in the project (Phase 4's `@tanstack/react-virtual` already guarded for this itself; Radix's `ScrollArea` doesn't).
- 9 new tests (194 total across 30 files, up from 185/28): `record-mapper.test.ts` (raw XML populated verbatim, sibling fields unaffected), `EventDetailsDrawer.test.tsx` (reveals/copies raw XML when present; correct disabled/empty state when absent or malformed; defensive narrowing against non-`{xml:string}` shapes; collapses again on switching events; existing parsed-detail UI unchanged), `EvidenceViewerPage.test.tsx` (row click now opens the drawer with the clicked event's raw XML; empty-case state still renders correctly).

### Notes
- No detection/scoring/IOC/correlation/vendor/path/service-legitimacy/kernel-driver/MITRE/case/timeline/search/export logic was touched. No change to Phase 4's virtualization implementation.
- Item 2 (configurable/extensible detection rule set) and Item 3 (printable/exportable case summary) remain unstarted, per explicit instruction.

## [0.1.6] - 2026-08-17

Per this changelog's versioning policy, this is a MINOR bump: Phase 4 adds functionality (evidence-table virtualization) and closes out an SDD §25 process-hardening phase.

### Added — Phase 4: Performance at Scale
- **Evidence-table row virtualization** (SDD §20, §7 Nice to Have "Virtualized table rendering for very large event sets (100k+ rows) to reduce DOM overhead"): `EvidenceTable.tsx` now renders its body rows through `@tanstack/react-virtual`'s `useVirtualizer`, scoped purely to the DOM layer — `useReactTable`'s state, sorting, filtering, selection, and pagination row model are all unchanged; the virtualizer only decides which already-computed rows get a real `<TableRow>` mounted at the current scroll position, using two spacer `<tr>` elements to preserve the correct scrollable height and real `<table>` semantics (SDD §21). New dependency: `@tanstack/react-virtual` (^3.14.9), the official TanStack pairing for `@tanstack/react-table`, already a project dependency.
- **Parser throughput benchmarks** (SDD §25 Phase 10 gate: "a defined large-file benchmark (event count, parse time, main-thread responsiveness) with measured results"): `src/backend/engine/__tests__/parser.bench.ts` and `record-mapper.bench.ts`, using Vitest's built-in `bench()` API (zero new dependency — Vitest ^2.0.5 was already installed). `parser.bench.ts` measures `parseEVTXBuffer`'s own loop/yield/resilience control flow at 10,000 and 100,000 synthetic records (mocking `@ts-evtx/core`'s binary layer, the same boundary Phase 2's `parser.test.ts` already established). `record-mapper.bench.ts` measures `xmlToEvent`'s real, unmocked per-record XML-mapping cost against representative Security-log XML. New `npm run bench` script (`vitest bench`) — not wired into CI, matching the project's existing pattern of manual/periodic (not per-PR) performance tooling.

### Notes
- **Evaluated, not changed:** the evidence table's existing pagination (`EvidenceTablePagination.tsx`, max page size 100) already bounds mounted DOM rows to ≤100 regardless of total event count — the "100k+ rows" DOM-overhead scenario SDD §7 describes does not currently manifest against the paginated view. Virtualization was implemented anyway per the roadmap's explicit "the evidence table" target, and is a real (if today modest, ≤100 → ~30 mounted rows) DOM-node reduction; it is also what makes raising the page-size cap safe to consider in a future phase without reintroducing DOM bloat. Page-size options themselves were left unchanged, per this phase's "preserve current UI design and behavior" constraint.
- **Measured baseline** (Node 20, this session's sandbox — see the Phase 4 report for full numbers): `parseEVTXBuffer`'s own control flow processes ~300,000 synthetic records/sec; `xmlToEvent`'s real per-record XML mapping runs at ~18,000 records/sec (~0.056ms/record), meaning real-world parse time is dominated by XML mapping (and the vendored binary/BinXML decode, unmeasured here) rather than this project's own loop overhead. No parser or record-mapper behavior was altered to produce these numbers.
- Did not benchmark memory usage as a separate deterministic harness: the SDD §25 Phase 10 gate names event count, parse time, and main-thread responsiveness specifically, not memory; noted as a remaining limitation, not silently skipped.

## [0.1.5] - 2026-08-17

Per this changelog's versioning policy, this is a MINOR bump: Phase 3 adds functionality (reduced-motion support, route-change focus management) and closes out an SDD §25 process-hardening phase.

### Added — Phase 3: Accessibility Hardening
- **Reduced motion** (SDD §21): `src/main.tsx` now wraps the app in framer-motion's own `<MotionConfig reducedMotion="user">` at the root, inside `ThemeProvider`. This automatically respects the OS/browser `prefers-reduced-motion: reduce` setting for every `motion.*`/`AnimatePresence` usage across the app (9 sites), with zero changes to any individual component and zero new dependencies — `framer-motion` was already installed.
- **Focus management on route change** (SDD §21): `src/layouts/AppShell.tsx`'s `<main>` landmark is now a focus target (`id="main-content" tabIndex={-1}`, `ref`); a `useEffect` keyed on `useLocation().pathname` moves focus to it on every navigation after the first, the standard React Router-recommended SPA accessibility pattern. Keyboard/screen-reader users landing on a new route no longer have focus silently stuck wherever it was on the previous page.
- **Automated axe-core accessibility checks** (SDD §24 item 6): new dev dependencies `jest-axe`, `@types/jest-axe`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `axe-core`, `jsdom`. `vitest.config.ts`'s `include` now also matches `src/**/*.test.tsx`; its global `environment: "node"` default is unchanged — new component/axe tests opt into `jsdom` individually via a `// @vitest-environment jsdom` docblock, so the pre-existing 171 Phase 2 tests are unaffected. `src/test/a11y-setup.ts` registers the `toHaveNoViolations` matcher and an explicit `afterEach(cleanup)` (required because this project's `globals: false` setting prevents React Testing Library's automatic cleanup-between-tests from self-registering); `src/test/vitest-axe.d.ts` augments Vitest's own `Assertion` type, since `@types/jest-axe` only targets Jest's namespaces. Four new test files scan representative components: `LevelBadge` (all 5 level variants), the shared `Table` primitive, `FilterToolbar`, and `DropZone`.
- 14 new tests (185 total across 26 files, up from 171/22), all passing.

### Fixed — Phase 3
- **`DropZone` nested-interactive violations** (found by the new axe scan, not previously known): the decorative "Select File" `<Button>` was a real native `<button>` nested inside the drop surface's own `role="button"` container, and the hidden file-input trigger was a real `<input type="file">` nested the same way — both are genuine WCAG "interactive controls must not be nested" defects (axe `nested-interactive`), since assistive technology can reach a nested native control regardless of `aria-hidden`/`tabIndex={-1}`. Fixed by rendering the decorative button as a `<span>` via `Button`'s existing `asChild` prop (identical visual styling, no interactive semantics), and by moving the hidden file input to be a sibling of the drop-surface card rather than a descendant. No visual, layout, or interaction change — click-to-browse, drag-and-drop, and keyboard (Enter/Space) activation all behave exactly as before.

### Notes
- Reused the project's existing `Button asChild` (Radix `Slot`) pattern rather than adding a new dependency or hand-rolling a styled span.
- SDD §21's other four accessibility requirements (skip link, semantic table structure, color-never-only-signal, keyboard operability of Radix-based menus/dialogs) were already satisfied prior to this phase and are unchanged.

## [0.1.4] - 2026-08-17

Per this changelog's versioning policy, this is a PATCH bump, not MINOR: extends Phase 2's test tooling only, no user-facing functionality change.

### Added — Phase 2 (extension): context/scoring layer test coverage
- A repository-wide verification confirmed `src/lib/detection/context/*` (`contextScoring.ts`, `pathContext.ts`, `vendorContext.ts`, `serviceContext.ts`) — the Phase 5.13/5.13.1 confidence model, correlation-suppression fix, and kernel-mode-driver signal all live here — had zero test coverage. This closes that gap:
  - `src/lib/detection/context/__tests__/pathContext.test.ts`: every `classifyPath` bucket, including the expanded trusted-system alternations (`\systemroot\system32\`, `\systemroot\syswow64\`, `system32\drivers\wd\`), plus a documented regression test for the `^c:\windows\` anchor's match-precedence over the more specific `\windowsapps\` alternative.
  - `src/lib/detection/context/__tests__/vendorContext.test.ts`: `matchKnownVendor` (including a regression test for the `"brave"` fragment) and `looksLikeRandomIdentifier` (GUIDs, digit-heavy tokens, vowel-less runs, ordinary names).
  - `src/lib/detection/context/__tests__/serviceContext.test.ts`: `parseEventDataMessage`, `classifyServiceAccount`, and `analyzeServiceContext` including the `serviceType` field.
  - `src/lib/detection/context/__tests__/contextScoring.test.ts`: pure-function tests for `isStronglyLegitimateService`, `shouldApplyCorrelationBonus` (service-installation AND scheduled-task suppression branches), `confidenceLevelFor`, `calculateFindingConfidence`, `computeThreatScoreBreakdown`, `scoreCategoryFor`, `getFindingExplanation`; plus end-to-end tests running real events through the actual `runDetectionEngine` pipeline to verify `evidenceSignals` generation (path/vendor/naming/kernel-mode-driver/SYSTEM-untrusted-path/encoded-command signals) and regression-test the Phase 5.13.1 correlation-suppression fix (mutually-legitimate service-install bursts, a suspicious neighbor overriding suppression, non-legitimate bursts still correlating, and the scheduled-task trusted-vendor/path suppression).
- 171 tests across 22 files, all passing (up from 91/18). `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.

### Notes
- No production code was modified. Two test assumptions were corrected against actual (unmodified) behavior rather than changing behavior to fit the test: `classifyPath`'s `^c:\windows\` anchor matches before the more specific `\windows\system32\`/`\windowsapps\` alternatives for any literal `C:\Windows\...` path — this is pre-existing, documented behavior, not a defect.

## [0.1.3] - 2026-08-14

Per this changelog's versioning policy, this is a PATCH bump, not MINOR: Phase 2 is test tooling only and changes no user-facing functionality.

### Added — Phase 2: Automated Test Foundation
- Vitest (`^2.0.5`) + `@vitest/coverage-v8` as dev dependencies; `vitest.config.ts` (merges into the existing `vite.config.ts` rather than duplicating its `@` alias / `EVTX_DEBUG` define). `npm run test` / `test:watch` / `test:coverage` scripts. `environment: "node"` — deliberately no `jsdom`/React Testing Library yet, since every unit covered this phase (SDD §24 items 1-4) is framework-free or a Zustand store; component/interaction tests (item 5) are Phase 3/9 scope.
- CI (`.github/workflows/ci.yml`): `npm run test` now runs between `format:check` and `build`.
- **Parser tests** (`src/backend/engine/__tests__/`): `record-mapper.test.ts` exercises `xmlToEvent` against crafted XML + a stub 3-method record interface — well-formed mapping, user-field resolution (EventData → UserData → Security UserID → "N/A" fallback chain), `renderXml()` throwing, invalid XML, missing `<System>`, and — the anti-fabrication guarantee documented in the source — a corrupt/throwing `timestampAsDate()` falling back to the raw `SystemTime` string or an empty string, never a fabricated date. `parser.test.ts` mocks `@ts-evtx/core`'s `BinaryReader`/`FileHeader`/`InvalidRecordException` to test `parseEVTXBuffer`'s own resilience control flow: too-small/truncated buffers, failed header verification, a throwing chunk generator, a throwing record generator, an individual record's `verify()` throwing without aborting the rest of the chunk, an already-aborted `AbortSignal`, and all three zero-events diagnostic branches — including confirming a genuinely empty channel (valid chunks, zero records attempted) is correctly NOT treated as a parse failure.
- **Detection rule tests** (`src/lib/detection/rules/__tests__/`): one file per rule (all 14), run through the real `runDetectionEngine` (not a hand-built single-rule harness) and filtered by `ruleId`, so each test exercises the actual registered pipeline. Covers each rule's fire/don't-fire conditions, plus the brute-force and successful-login-after-failures rules' sliding-window boundary cases (exactly enough events in-window vs. spread just outside it).
- **Risk-score tests** (`src/backend/__tests__/risk-score.test.ts`): `computeRiskScore` exercised with exact expected values derived from its own documented formula — severity contribution caps, confidence scaling, all four category thresholds (80/60/40/0), 100-point clamping, and the dedup/log2 grouping curve (a 200-count identical-finding cluster demonstrated scoring dramatically lower than 200 distinct findings at the same per-finding contribution).
- **Store tests** (`src/store/__tests__/evidenceStore.test.ts`): `loadFiles`' branching with `@/services/evtxApi` mocked wholesale — full success, single- and multi-file parse failure (including the different user-facing error strings for each), multi-file partial failure, and detection/summary failure isolation. Surfaced a real, previously-undocumented asymmetry: a `detectIOCs` failure zeroes out findings/summary entirely, while a *later* `generateInvestigationSummary` failure preserves the findings already computed before it (JS doesn't roll back prior statements in a try block on a later throw).
- 91 tests across 18 files, all passing; `npx tsc --noEmit` and `npm run build` both clean.

## [0.1.2] - 2026-07-31

### Fixed
- **Critical: EVTX parsing produced zero usable events.** `src/backend/engine/record-mapper.ts` used `DOMParser`, a Web API not exposed to any Worker global scope in any browser (per the DOM Parsing and Serialization spec's `[Exposed=Window]` restriction) — every one of the parser Worker's record-mapping calls threw `ReferenceError: DOMParser is not defined` and was silently caught by the outer resilience loop in `engine/parser.ts`, producing "0 usable events" despite every chunk and record passing verification. Replaced with `fast-xml-parser`, a pure-JavaScript XML parser with no DOM dependency. See `docs/ARCHITECTURE_DECISIONS.md` ADR-010 for the full analysis, alternatives considered, and verification method (cross-validated against the original DOMParser-based implementation across 6 representative record shapes, plus direct execution of the actual compiled fix).

### Added
- `fast-xml-parser` (^5.10.1) as a runtime dependency.

## [0.1.1] - 2026-07-31

Per this changelog's versioning policy, this is a PATCH bump, not MINOR: Phase 1 is tooling/config/dev-environment only and changes no user-facing functionality (see Objective in the Phase 1 report).

### Added — Phase 1: Project Foundation / Architecture & Foundation Hardening
- ESLint 9 (flat config, `eslint.config.js`) with `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y`, and `eslint-config-prettier`. Two narrow, documented rule overrides for known false positives: `.d.ts` module-augmentation files (`no-unused-vars`) and generated shadcn/ui primitives (`jsx-a11y/heading-has-content`).
- Prettier (`.prettierrc.json`, `.prettierignore`) as the single formatting authority.
- `.editorconfig`, `.env.example` (documents that no environment variables are needed), `.nvmrc` (Node 20), and an `engines.node` field in `package.json`.
- GitHub Actions CI (`.github/workflows/ci.yml`): install → typecheck → lint → format:check → build on every push/PR.
- `npm run lint`, `lint:fix`, `format`, `format:check` scripts.
- Two new strict TypeScript compiler options, each verified by trial-compiling against the real codebase before adopting: `verbatimModuleSyntax` (zero files affected) and `noImplicitOverride` (one file, `ErrorBoundary.tsx`, fixed by adding the `override` keyword to its three overridden members).
- README `Development` and `Documentation` sections; link to `SDD.md` and `docs/`.

### Changed
- Repo-wide Prettier formatting pass (33 pre-existing files). Formatting only — no logic changed; verified via identical typecheck/lint results and an identical production build before and after.

### Removed
- `src/backend/evtx-parser.ts`: an unused, unreferenced duplicate `parseEVTXBuffer()` export and its duplicate `MIN_FILE_SIZE` constant (confirmed dead via repo-wide search — the real, in-use `parseEVTXBuffer` lives in `engine/parser.ts` and is what the worker actually calls).
- `src/lib/mock-events.ts`: dead code, unused since the real parser shipped. Content neutralized to an empty, documented stub rather than deleted — this environment's mounted working directory does not support file deletion (see `PROJECT_PROGRESS.md`'s Known Constraints).

## [0.1.0] - 2026-07-25

### Added
- Initial baseline (ledger: Phase 0) — full MVP feature set delivered prior to formal documentation/process tracking:
  - Client-side EVTX parsing, Web Worker–based, resilient to corrupt/dirty/partially-overwritten files.
  - Rule-based suspicious-event detection (10 rules, MITRE ATT&CK–mapped where applicable) and deterministic 0–100 risk scoring.
  - Auto-generated, deterministic investigation summary.
  - Case dashboard (stat cards, risk score, findings panel, summary panel).
  - Evidence viewer: full-text search, multi-field filtering, sorting, pagination, row selection.
  - Chronological, day-grouped, severity-color-coded timeline view.
  - Cross-panel linking (finding → event, in table and timeline).
  - CSV and JSON export respecting active search/filters.
  - Dark/light theme, fully responsive layout.
  - Static-site deployment configuration (Vercel).
