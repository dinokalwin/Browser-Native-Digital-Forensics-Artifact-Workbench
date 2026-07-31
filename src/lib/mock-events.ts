/**
 * Superseded by the real browser-native EVTX parser (see
 * src/backend/evtx-parser.ts, wired in as of the SDD's Phase 6).
 *
 * This file originally held a deterministic mock EVTX dataset used to
 * develop the Evidence Table's search/sort/filter/pagination UI before a
 * real parser existed. Nothing in `src` imports it anymore (verified via
 * repo-wide search as part of Phase 1's dead-code removal — see
 * docs/CHANGELOG.md).
 *
 * Kept as an empty file rather than deleted: this sandboxed environment's
 * mounted output directory doesn't support file deletion (the same
 * constraint already documented in src/types/backend-api.d.ts). If your
 * local toolchain supports it, this file can be safely `git rm`'d.
 */
export {};
