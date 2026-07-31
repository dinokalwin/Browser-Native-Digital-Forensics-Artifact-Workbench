# Contributing — DFIR Workbench

## Development setup

1. Node.js — version pinned in `.nvmrc` (added in Phase 1).
2. `npm install` — this also applies the `@ts-evtx/core` browser-compatibility patch via `patch-package` automatically through the `postinstall` script. Do not skip or work around this step; the app will crash at runtime without the patch.
3. `npm run dev` — starts the Vite dev server.

## Before starting work

- Read `CODING_STANDARDS.md` and follow it — this codebase has established conventions; new code should look like it already belongs.
- Read `PHASE_CHECKLIST.md` — every phase of work is expected to satisfy the generic checklist plus its own phase-specific acceptance criteria.
- Confirm which phase (per `PROJECT_PROGRESS.md`) the work belongs to. Out-of-phase or future-phase work is not accepted — the project's core development rule is to build one phase at a time, fully, before starting the next.

## Making a change

- `npm run typecheck` must pass; once Phase 1 ships them, `npm run lint` and `npm run format:check` must pass too.
- Touch only the files relevant to the task at hand — no drive-by rewrites of unrelated working code.
- Preserve all existing functionality. If a change appears to require altering something outside the current phase's approved scope, stop and flag it rather than expanding scope silently.
- Log any architecturally significant decision in `ARCHITECTURE_DECISIONS.md` as it's made.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <description>`. Example: `chore(foundation): add ESLint, Prettier, CI baseline (Phase 1)`. Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

## Closing out a phase

Update `PROJECT_PROGRESS.md` (phase status, percentage complete, milestone table) and `CHANGELOG.md` (dated entry, semver bump) as part of the phase's Definition of Done — see `PHASE_CHECKLIST.md` for the full close-out checklist.
