import { SEARCH_RESULT_TYPE_LABEL, type SearchResult, type SearchResultGroupData } from "@/lib/search/types";
import { SearchResultItem } from "@/components/search/SearchResultItem";

interface SearchResultGroupProps {
  group: SearchResultGroupData;
  freeText: string;
  /** DOM id of the currently keyboard-active result, or `null` if none —
   * compared against `getItemId(result)` per row so exactly one
   * `SearchResultItem` renders `aria-selected`. */
  activeResultId: string | null;
  /** Turns a `SearchResult` into the same stable DOM id
   * `SearchCommand.tsx`'s flattened navigation list uses, so keyboard
   * arrow-key selection and mouse hover always agree on identity. */
  getItemId: (result: SearchResult) => string;
  onSelect: (result: SearchResult) => void;
  onHover: (result: SearchResult) => void;
}

/**
 * One labeled section of the results list — "Events (12)", "IOC Findings
 * (3)", etc. — rendered in the fixed order `searchEngine.ts#groupAndCap`
 * already produced (ticket "8. RESULT GROUPS"). This component performs no
 * grouping, sorting, or capping of its own; it only renders the
 * `SearchResultGroupData` it's handed.
 */
export function SearchResultGroup({ group, freeText, activeResultId, getItemId, onSelect, onHover }: SearchResultGroupProps) {
  if (group.results.length === 0) return null;

  const headingId = `search-group-heading-${group.type}`;

  return (
    <div role="presentation" className="px-1 py-1">
      <p
        id={headingId}
        className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {SEARCH_RESULT_TYPE_LABEL[group.type]}
        <span className="ml-1 font-normal normal-case text-muted-foreground/70">({group.results.length})</span>
      </p>
      <ul role="presentation" aria-labelledby={headingId} className="flex flex-col gap-0.5">
        {group.results.map((result) => {
          const itemId = getItemId(result);
          return (
            <SearchResultItem
              key={result.id}
              id={itemId}
              result={result}
              freeText={freeText}
              isActive={itemId === activeResultId}
              onSelect={onSelect}
              onMouseEnter={() => onHover(result)}
            />
          );
        })}
      </ul>
    </div>
  );
}
