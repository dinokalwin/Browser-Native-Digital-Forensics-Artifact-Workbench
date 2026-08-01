import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  LEVEL_FILTER_OPTIONS,
  type TimelineFilters,
} from "@/lib/timeline";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// Same visual treatment as FilterToolbar.tsx's native `<select>` elements
// (src/components/dashboard/FilterToolbar.tsx) — duplicated here rather
// than imported/refactored out, since that file isn't part of this
// sprint's scope and these are two small, stable CSS strings, not shared
// logic. See that file's own comment for why a native `<select>` (not a
// new Radix Select dependency) is this project's established pattern.
const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";
const optionClassName = "bg-popover text-foreground checked:bg-primary checked:text-primary-foreground";

interface FilterFieldProps {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}

function FilterField({ label, htmlFor, className, children }: FilterFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export interface TimelineToolbarProps {
  filters: TimelineFilters;
  onFiltersChange: (filters: TimelineFilters) => void;
  hasActiveFilters: boolean;
  /** Unique provider names for the dropdown — see getUniqueProviders in lib/eventFilters.ts (re-exported by lib/timeline.ts). */
  providers: string[];
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Timeline-page search & filter bar (Sprint 4.3) — Search, Provider,
 * Level, Bookmarked Only, Notes Only, Reset Filters, all in one toolbar.
 * Purely presentational/controlled, same shape as
 * `components/dashboard/FilterToolbar.tsx`: every field reflects
 * `filters` and reports changes via `onFiltersChange`; the only logic
 * living here is debouncing the search box — matching/aggregation itself
 * is `filterTimelineEvents` in lib/timeline.ts, not here.
 */
export function TimelineToolbar({
  filters,
  onFiltersChange,
  hasActiveFilters,
  providers,
  className,
}: TimelineToolbarProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search);

  // Same "adjust state during render" resync pattern as FilterToolbar.tsx —
  // re-syncs local text only when `filters.search` actually changes out
  // from under us (e.g. Reset Filters), not on every render.
  const [syncedSearch, setSyncedSearch] = React.useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setSearchInput(filters.search);
  }

  const filtersRef = React.useRef(filters);
  const onFiltersChangeRef = React.useRef(onFiltersChange);
  React.useEffect(() => {
    filtersRef.current = filters;
    onFiltersChangeRef.current = onFiltersChange;
  });

  const debounceHandle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (debounceHandle.current) clearTimeout(debounceHandle.current);
    };
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceHandle.current) clearTimeout(debounceHandle.current);
    debounceHandle.current = setTimeout(() => {
      onFiltersChangeRef.current({ ...filtersRef.current, search: value });
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleReset = () => {
    if (debounceHandle.current) clearTimeout(debounceHandle.current);
    setSearchInput("");
    onFiltersChange({ search: "", provider: null, level: "All", bookmarkedOnly: false, notesOnly: false });
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <FilterField label="Search Events" htmlFor="timeline-filter-search">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="timeline-filter-search"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search by event ID, provider, computer, user, or message…"
            className="h-10 pl-9 text-sm"
          />
        </div>
      </FilterField>

      <div className="flex flex-wrap items-end gap-4">
        <FilterField label="Provider" htmlFor="timeline-filter-provider" className="min-w-[160px] flex-1">
          <select
            id="timeline-filter-provider"
            className={selectClassName}
            aria-label="Filter by provider"
            value={filters.provider ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, provider: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="" className={optionClassName}>
              All Providers
            </option>
            {providers.map((provider) => (
              <option key={provider} value={provider} className={optionClassName}>
                {provider}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Level" htmlFor="timeline-filter-level" className="min-w-[140px] flex-1">
          <select
            id="timeline-filter-level"
            className={selectClassName}
            aria-label="Filter by level"
            value={filters.level}
            onChange={(e) =>
              onFiltersChange({ ...filters, level: e.target.value as TimelineFilters["level"] })
            }
          >
            {LEVEL_FILTER_OPTIONS.map((level) => (
              <option key={level} value={level} className={optionClassName}>
                {level}
              </option>
            ))}
          </select>
        </FilterField>

        <label
          htmlFor="timeline-filter-bookmarked"
          className="flex h-9 items-center gap-2 text-sm text-foreground"
        >
          <Checkbox
            id="timeline-filter-bookmarked"
            checked={filters.bookmarkedOnly}
            onCheckedChange={(value) => onFiltersChange({ ...filters, bookmarkedOnly: value === true })}
          />
          Bookmarked Only
        </label>

        <label
          htmlFor="timeline-filter-notes"
          className="flex h-9 items-center gap-2 text-sm text-foreground"
        >
          <Checkbox
            id="timeline-filter-notes"
            checked={filters.notesOnly}
            onCheckedChange={(value) => onFiltersChange({ ...filters, notesOnly: value === true })}
          />
          Notes Only
        </label>

        <Button
          variant="ghost"
          size="sm"
          disabled={!hasActiveFilters}
          onClick={handleReset}
          className="ml-auto gap-1.5"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
