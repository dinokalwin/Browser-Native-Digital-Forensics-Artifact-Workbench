# Phase Checklist — DFIR Workbench

A reusable checklist for every phase, from planning through close-out. Copy the relevant sections into the phase's tracking notes and fill them in; update `PROJECT_PROGRESS.md` and `CHANGELOG.md` as part of closing the phase out.

## Pre-Implementation

- [ ] Objectives stated and scoped to this phase only
- [ ] Features to implement listed explicitly
- [ ] Files to create / modify listed explicitly
- [ ] Folder structure changes (if any) listed explicitly
- [ ] Dependencies to install listed explicitly, with justification for each
- [ ] Acceptance criteria defined and measurable
- [ ] Risks identified, each with a mitigation or an explicit, stated acceptance
- [ ] Plan explained to and approved by the project owner before any code is written

## Implementation

- [ ] Only the approved phase's scope is touched — no future-phase work included
- [ ] No previously working functionality removed or altered unintentionally
- [ ] Strict TypeScript maintained; no `any` introduced
- [ ] New code follows `CODING_STANDARDS.md`
- [ ] Only files listed in the approved plan are created or modified (any deviation is called out explicitly, not silently)
- [ ] Architecturally significant decisions made during implementation are logged in `ARCHITECTURE_DECISIONS.md` as they happen, not reconstructed afterward

## Acceptance Criteria

Generic baseline — supplement with the phase-specific criteria from its approved plan:

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (available from Phase 1 onward)
- [ ] `npm run build` succeeds
- [ ] Every acceptance criterion listed in the phase's approved plan is met, one-for-one

## Testing Checklist

Generic baseline — supplement with the phase-specific tests from its approved plan:

- [ ] `npm install` completes cleanly, including the `@ts-evtx/core` patch via `patch-package`
- [ ] `npm run dev` — manual smoke test of every existing workflow (upload, dashboard, evidence viewer, timeline, export, theme toggle, responsive layout at mobile/tablet/desktop widths)
- [ ] `npm run build` + `npm run preview` — the production build is verified, not just the dev server
- [ ] No new console errors or warnings
- [ ] Regression check: every feature that worked before this phase still works identically after it
- [ ] Automated tests pass and cover any new logic (from Phase 2 onward, once the suite exists)

## Definition of Done

A phase is Done only when **all** of the following are true:

- [ ] All acceptance criteria met
- [ ] All testing checklist items pass
- [ ] `PROJECT_PROGRESS.md` updated — phase moved from current/remaining to completed, percentage recalculated, milestone table updated
- [ ] `CHANGELOG.md` updated with a dated entry for the phase, following semantic versioning
- [ ] `ARCHITECTURE_DECISIONS.md` updated if the phase introduced or changed an architectural decision
- [ ] Before vs. After comparison provided
- [ ] Screenshot suggested (and, where practical, captured) for progress tracking
- [ ] Git commit message provided, following the Conventional Commits format in `CODING_STANDARDS.md`
- [ ] Project confirmed buildable (`npm run build` green) at the end of the phase

---

## Phase 1 instance

Status: plan approved 2026-07-31, not yet implemented. Once implemented, this section will be filled in against the criteria above using the approved Phase 1: Project Foundation plan (objectives, files, dependencies, risks, and its phase-specific acceptance/testing criteria).
