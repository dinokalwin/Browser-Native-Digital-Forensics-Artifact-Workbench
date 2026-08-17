import * as React from "react";
import { useNavigate } from "react-router-dom";
import { History, Trash2 } from "lucide-react";

import { useEvidenceStore } from "@/store/evidenceStore";
import {
  useHydrateRecentSearches,
  useSearchIndex,
  useSearchResults,
  useSearchStore,
} from "@/store/searchStore";
import { hasActiveSearchFilters, type SearchResult } from "@/lib/search/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";

/**
 * Full-page Global Investigation Search (`/dashboard/search`, ticket "3.
 * ROUTE + ARCHITECTURE"). Deliberately reuses the exact same building
 * blocks the Ctrl/Cmd+K palette (`SearchCommand.tsx`) does —
 * `SearchInput`/`SearchFilters`/`SearchResults`, and the same
 * `searchStore.ts` hooks (`useSearchIndex`/`useSearchResults`) — rather
 * than a second search implementation; the only genuinely new code here is
 * this page's own chrome (a `PageHeader` + a `Card` instead of a `Dialog`)
 * and its own keyboard-navigation/selection wiring, since a full page has
 * no dialog to inherit that from.
 *
 * Deliberately shares `searchStore.ts`'s global `query`/`filters` state
 * (not page-local state) with the command palette: opening Ctrl/Cmd+K from
 * this page — or arriving here after typing into the palette — shows the
 * same in-progress search either way, which reads as one coherent search
 * feature with two entry points rather than two unrelated ones that happen
 * to look similar.
 */
export default function SearchPage() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const addRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const clearRecentSearches = useSearchStore((s) => s.clearRecentSearches);
  useHydrateRecentSearches();

  const events = useEvidenceStore((s) => s.events);
  const hasInvestigation = events.length > 0;

  const index = useSearchIndex();
  const { response, isSearching } = useSearchResults(index, query, filters);
  const techniqueIds = React.useMemo(() => Array.from(index.byTechniqueId.keys()), [index]);

  const navigate = useNavigate();

  const [activeIndex, setActiveIndex] = React.useState(0);
  const flatResults = React.useMemo(
    () => (response ? response.groups.flatMap((group) => group.results) : []),
    [response],
  );

  // Render-time reset (see `SearchCommand.tsx`'s identical comment) rather
  // than a `useEffect` — the top result is already selected on the very
  // first render of a new `response`.
  const [prevResponse, setPrevResponse] = React.useState(response);
  if (response !== prevResponse) {
    setPrevResponse(response);
    setActiveIndex(0);
  }

  const getItemId = React.useCallback((result: SearchResult) => `search-page-result-${result.id}`, []);
  const activeResult = flatResults[activeIndex] ?? null;
  const activeResultId = activeResult ? getItemId(activeResult) : null;

  const handleSelect = React.useCallback(
    (result: SearchResult) => {
      addRecentSearch(query, filters);
      if (result.route) {
        navigate(result.route, result.metadata ? { state: result.metadata } : undefined);
      }
    },
    [addRecentSearch, query, filters, navigate],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeResult) handleSelect(activeResult);
    }
  };

  const showRecentSearches = query.trim().length === 0 && !hasActiveSearchFilters(filters) && recentSearches.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Investigation Search"
        description="Search events, IOC findings, MITRE techniques, notes, bookmarks, and case metadata all at once."
      />

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
          <SearchInput
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- dedicated search page: an investigator navigating here means to search immediately (same reasoning as SearchInput.tsx's own doc comment for the command palette).
            autoFocus
            expanded={flatResults.length > 0}
            activeDescendantId={activeResultId ?? undefined}
          />

          <SearchFilters filters={filters} onFiltersChange={setFilters} events={events} techniqueIds={techniqueIds} />

          {showRecentSearches ? (
            <div role="presentation">
              <div className="flex items-center justify-between px-1 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent Searches</p>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Clear
                </button>
              </div>
              <ul role="presentation" className="flex flex-col gap-0.5">
                {recentSearches.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(entry.query);
                        setFilters(entry.filters);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md p-2 text-left text-sm text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{entry.query}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <SearchResults
              hasInvestigation={hasInvestigation}
              eventCount={events.length}
              query={query}
              filters={filters}
              response={response}
              isSearching={isSearching}
              activeResultId={activeResultId}
              getItemId={getItemId}
              onSelect={handleSelect}
              onHover={(result) => {
                const nextIndex = flatResults.findIndex((r) => r.id === result.id);
                if (nextIndex >= 0) setActiveIndex(nextIndex);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
