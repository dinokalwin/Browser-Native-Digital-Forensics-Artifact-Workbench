# Project Progress — DFIR Workbench

Last updated: 2026-07-31

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

**Phase 2 — Automated Test Foundation.** Not yet started; not yet planned in detail.

## Completed phases

- **Phase 0 — Baseline** — MVP feature-complete: EVTX parsing (Web Worker–based, resilient to corrupt files), rule-based suspicious-event detection, risk scoring, investigation summary, dashboard, evidence viewer, timeline, CSV/JSON export, dark/light theme, responsive layout, static-site deployment config.
- **Phase 1 — Project Foundation / Architecture & Foundation Hardening** — completed 2026-07-31. ESLint 9 (flat config) + Prettier baseline, GitHub Actions CI, pinned Node version, `.env.example`, two safe strict-TypeScript additions (`verbatimModuleSyntax`, `noImplicitOverride`), removal of one dead file (`mock-events.ts`, neutralized — see Known Constraints below) and one unused duplicate export (`evtx-parser.ts`'s orphaned `parseEVTXBuffer`), and a repo-wide Prettier formatting pass (33 files, whitespace/formatting-only, verified behavior-identical via typecheck/lint/build before and after). Zero visible functionality changed; zero parser logic touched. See `CHANGELOG.md` for the full breakdown and the conversation's Phase 1 report for before/after detail.

## Critical Fix (post-Phase-1, pre-Phase-2)

- **2026-07-31 — EVTX parsing was silently producing zero usable events.** A user-driven manual verification pass (per Phase 1's Manual Verification Checklist) caught this — it could not have been caught by typecheck, lint, or build, since it was a runtime-only failure specific to executing inside a Worker. Root cause: `record-mapper.ts` used `DOMParser`, which is not available in any Worker global scope in any browser. Fixed by switching to `fast-xml-parser`. See `docs/ARCHITECTURE_DECISIONS.md` ADR-010 and `CHANGELOG.md` [0.1.2]. **This revises the "Functional scope: 11/11 delivered = 100%" figure below** — that figure reflected feature/architecture presence, not verified runtime correctness end-to-end with a real file in a real browser. It is accurate again as of this fix, but the gap it was hiding is itself a data point: automated end-to-end coverage (Phase 2) matters more than this ledger previously weighted it.

## Known Constraints

- This project's mounted working directory does not support file deletion (unlink/rename) from the assistant's tooling — confirmed during Phase 1 when removing `src/lib/mock-events.ts`. The established workaround (already used once before, in `src/types/backend-api.d.ts`) is to neutralize the file's content to an empty, documented stub rather than remove it. A contributor with normal local file access can `git rm` these stubs at any time.

## Remaining phases

- Phase 2 — Automated Test Foundation
- Phase 3 — Accessibility Hardening
- Phase 4 — Performance at Scale
- Phase 5 — Detection & Reporting Depth
- Phase 6 — Stretch Evaluation

## Percentage complete

Tracked along two dimensions, because they answer different questions:

- **Functional scope** (SDD §7 Must Have features): 11 / 11 delivered = **100%**
- **Engineering process phases** (this ledger, Phase 1–6): 1 / 6 complete = **17%**
- **Blended project completion** (weighted 60% functional, 40% process — process work being what primarily remains before the project is considered production-hardened): **67%**

This blended figure will be recalculated at the close of every phase per `PHASE_CHECKLIST.md`'s Definition of Done.

## Milestones

| Milestone | Status | Date |
|---|---|---|
| MVP feature-complete | Done | 2026-07-25 (approx., pre-SDD) |
| Software Design Document approved | Done | 2026-07-31 |
| Documentation framework established | Done | 2026-07-31 |
| Phase 1 (Project Foundation / Foundation Hardening) shipped | Done | 2026-07-31 |
| Phase 2 (automated test suite) shipped | Not started | — |
| Phase 3 (accessibility audit passed) | Not started | — |
| Phase 4 (performance benchmarked at scale) | Not started | — |
| v1.0.0 candidate ready for external review | Not started | — |
