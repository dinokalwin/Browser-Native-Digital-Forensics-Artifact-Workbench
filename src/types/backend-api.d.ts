/**
 * Superseded by the real (stub) module at `src/backend/index.ts`.
 *
 * This file originally held an ambient `declare module "@/backend"`
 * contract for a module that didn't exist on disk yet. Now that
 * `src/backend/index.ts` exists as a throwing placeholder with the same
 * exported signatures, TypeScript resolves "@/backend" to that real
 * file directly and this ambient declaration is no longer needed. Kept
 * as an empty file (rather than deleted, since this sandboxed output
 * directory doesn't support file deletion) — see `src/backend/index.ts`
 * for the authoritative contract.
 */
export {};
