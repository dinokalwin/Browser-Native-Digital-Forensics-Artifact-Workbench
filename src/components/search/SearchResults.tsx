import { hasSearchIntent } from "@/lib/search";
import { hasActiveSearchFilters, type SearchFilters, type SearchResponse, type SearchResult } from "@/lib/search/types";
import { SearchResultGroup } from "@/components/search/SearchResultGroup";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { SearchLoadingState } from "@/components/search/SearchLoadingState";

interface SearchResultsProps {
  /** Whether an investigation is currently loaded at all (`evidenceStore`
   * has events) — distinguishes the "no-investigation" empty state from
   * every other one, which all assume there's something to search. */
  hasInvestigation: boolean;
  eventCount: number;
  query: string;
  filters: SearchFilters;
  response: SearchResponse | null;
  isSearching: boolean;
  activeResultId: string | null;
  getItemId: (result: SearchResult) => string;
  onSelect: (result: SearchResult) => void;
  onHover: (result: SearchResult) => void;
}

/**
 * Decides which of the six named empty states (ticket "14. EMPTY STATES"),
 * the loading state, or the actual grouped result list to render — the
 * only piece of "orchestration" in this file is that single decision.
 * Every count, group, and score already comes pre-computed on `response`
 * (built by `searchEngine.ts#search`, which is itself built once by
 * `searchStore.ts#useSearchResults`); this component performs no
 * aggregation of its own (ticket "25. ARCHITECTURE CHECK — UI does not
 * perform aggregation").
 */
export function SearchResults({
  hasInvestigation,
  eventCount,
  query,
  filters,
  response,
  isSearching,
  activeResultId,
  getItemId,
  onSelect,
  onHover,
}: SearchResultsProps) {
  if (!hasInvestigation) {
    return <SearchEmptyState variant="no-investigation" />;
  }

  if (!hasSearchIntent(query, filters)) {
    return <SearchEmptyState variant="no-query" />;
  }

  if (isSearching && !response) {
    return <SearchLoadingState eventCount={eventCount} />;
  }

  if (!response || response.totalCount === 0) {
    const variant = hasActiveSearchFilters(filters) ? "no-filter-match" : "no-results";
    return <SearchEmptyState variant={variant} />;
  }

  return (
    <div id="global-search-results" role="listbox" aria-label="Search results" className="flex flex-col overflow-y-auto py-1">
      {/* Visually hidden, announced on every result-count change — ticket
       * "17. ACCESSIBILITY — announce result counts to screen readers"
       * without repeating that announcement visibly next to every group
       * heading, which already shows its own count. */}
      <p role="status" aria-live="polite" className="sr-only">
        {response.totalCount === 1 ? "1 result found" : `${response.totalCount.toLocaleString()} results found`}
      </p>
      {response.groups.map((group) => (
        <SearchResultGroup
          key={group.type}
          group={group}
          freeText={response.freeText}
          activeResultId={activeResultId}
          getItemId={getItemId}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </div>
  );
}
