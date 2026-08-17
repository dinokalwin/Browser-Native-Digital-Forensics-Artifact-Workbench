import * as React from "react";
import { useNavigate } from "react-router-dom";
import { History, SlidersHorizontal, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useEvidenceStore } from "@/store/evidenceStore";
import {
  useHydrateRecentSearches,
  useSearchIndex,
  useSearchResults,
  useSearchStore,
} from "@/store/searchStore";
import { hasActiveSearchFilters, type SearchResult } from "@/lib/search/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/search/SearchInput";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchResults } from "@/components/search/SearchResults";

/**
 * The Ctrl/Cmd+K command palette itself (ticket "7. COMMAND PALETTE") —
 * reuses this project's existing `ui/dialog.tsx` primitive (Radix Dialog,
 * already used by `RenameCaseDialog.tsx`/`DeleteCaseDialog.tsx`) rather
 * than installing a dedicated command-palette library, per the ticket's
 * explicit "do NOT install another command palette library unless
 * absolutely necessary" instruction. `Dialog`'s own Escape/overlay-click
 * dismissal already satisfies "Escape closes" with zero extra code here.
 *
 * Owns exactly one piece of orchestration state beyond what
 * `searchStore.ts` already provides: `activeIndex`, the keyboard-selected
 * position within the current flattened result list (Up/Down/Enter). Both
 * the index itself (`useSearchIndex`) and the scored/grouped response
 * (`useSearchResults`) are computed elsewhere — this component never
 * ranks, filters, or aggregates a result it wasn't already handed.
 */
export function SearchCommand() {
  const isOpen = useSearchStore((s) => s.isOpen);
  const close = useSearchStore((s) => s.close);
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

  const [showFilters, setShowFilters] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const flatResults = React.useMemo(
    () => (response ? response.groups.flatMap((group) => group.results) : []),
    [response],
  );

  // A new response (new query, new filters, or the index itself changing)
  // always re-selects the top result — an old activeIndex pointing past
  // the end of a now-shorter list would otherwise silently select nothing.
  // Reset during render (React's documented "adjusting state when a prop
  // changes" pattern — see react.dev "You Might Not Need an Effect")
  // rather than in a `useEffect`, the same render-time-adjustment
  // convention `MitreAttackPage.tsx`'s `focusTechniqueId` consumer and
  // `DashboardPage.tsx`'s `focusEventId` consumer already use: the very
  // first render that sees a new `response` already shows the top result
  // selected, with no extra render cycle and no `react-hooks/set-state-in-
  // effect` violation.
  const [prevResponse, setPrevResponse] = React.useState(response);
  if (response !== prevResponse) {
    setPrevResponse(response);
    setActiveIndex(0);
  }

  const getItemId = React.useCallback((result: SearchResult) => `search-result-${result.id}`, []);
  const activeResult = flatResults[activeIndex] ?? null;
  const activeResultId = activeResult ? getItemId(activeResult) : null;

  const handleClose = React.useCallback(() => {
    close();
    setShowFilters(false);
  }, [close]);

  const handleSelect = React.useCallback(
    (result: SearchResult) => {
      addRecentSearch(query, filters);
      handleClose();
      if (result.route) {
        navigate(result.route, result.metadata ? { state: result.metadata } : undefined);
      }
    },
    [addRecentSearch, query, filters, handleClose, navigate],
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
    // Escape is intentionally NOT handled here — Radix's Dialog already
    // dismisses on Escape (its DismissableLayer listens at the document
    // level), so re-implementing it here would just be redundant.
  };

  const handleRecentSearchClick = (entryQuery: string, entryFilters: typeof filters) => {
    setQuery(entryQuery);
    setFilters(entryFilters);
  };

  const showRecentSearches = query.trim().length === 0 && !hasActiveSearchFilters(filters) && recentSearches.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="top-[12%] max-w-2xl translate-y-0 gap-0 overflow-hidden rounded-lg p-0 sm:top-[12%]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Global Investigation Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search events, IOC findings, MITRE techniques, notes, bookmarks, and cases in this investigation.
        </DialogDescription>

        <SearchInput
          value={query}
          onChange={setQuery}
          onKeyDown={handleKeyDown}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- see SearchInput.tsx's own doc comment: Radix Dialog's auto-focus lands on the content container, not this nested input, and a command palette needs to be typeable the instant it opens.
          autoFocus
          className="pr-9"
          expanded={flatResults.length > 0}
          activeDescendantId={activeResultId ?? undefined}
        />

        <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              showFilters && "text-foreground",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Filters
            {hasActiveSearchFilters(filters) && (
              <Badge variant="default" className="h-4 px-1.5 text-[10px]">
                Active
              </Badge>
            )}
          </button>
          {response && (
            <span className="text-[10px] text-muted-foreground">
              {response.totalCount.toLocaleString()} results · {response.durationMs.toFixed(1)}ms
            </span>
          )}
        </div>

        {showFilters && (
          <div className="border-b border-border px-3 py-3">
            <SearchFilters filters={filters} onFiltersChange={setFilters} events={events} techniqueIds={techniqueIds} />
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto">
          {showRecentSearches ? (
            <div role="presentation" className="px-1 py-1">
              <div className="flex items-center justify-between px-2 pb-1 pt-2">
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
                      onClick={() => handleRecentSearchClick(entry.query, entry.filters)}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
