# Changelog

All notable changes to DFIR Workbench are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/).

**Versioning policy while pre-1.0:** `0.MINOR.PATCH`. MINOR bumps for each completed phase that adds functionality; PATCH for fixes or tooling-only changes with no user-facing functionality change. `1.0.0` is reserved for the point at which all SDD §7 Must Have features are delivered *and* the process-hardening phases — automated test suite, accessibility audit, performance benchmark — are complete.

## [Unreleased]

Nothing pending. Phase 2 (Automated Test Foundation) has not yet been planned.

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
