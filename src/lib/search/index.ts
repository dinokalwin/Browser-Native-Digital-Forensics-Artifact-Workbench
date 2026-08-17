/**
 * Global Investigation Search — public entry point (Phase 5.12).
 *
 * Barrel re-export so `store/searchStore.ts` and every `components/search/*`
 * consumer imports one path (`@/lib/search`) instead of reaching into each
 * internal module individually — same convention `lib/mitre`'s own
 * internal modules follow for each other, applied here at the package
 * boundary.
 */
export * from "./types";
export * from "./tokenizer";
export {
  buildSearchIndex,
  type BuildSearchIndexInput,
  type IndexedEntry,
  type SearchIndex,
} from "./indexBuilder";
export { search, hasSearchIntent } from "./searchEngine";
export { RANKING_POINTS, detectExactEventId, detectExactTechniqueId } from "./ranking";
