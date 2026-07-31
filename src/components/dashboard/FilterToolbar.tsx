import * as React from "react";
import { Search, Hash, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  LEVEL_FILTER_OPTIONS,
  parseEventIdInput,
  hasActiveFilters,
  type InvestigationFilters,
} from "@/lib/eventFilters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Tailwind classes for the native `<select>` elements below, matching
 * `Input`'s visual treatment (src/components/ui/input.tsx) so the toolbar
 * reads as one design system even though this project doesn't have a
 * shadcn/Radix `Select` primitive yet (only `dropdown-menu.tsx`, which is
 * built for menus/actions, not a bound `<select>`-style form control).
 * Introducing `@radix-ui/react-select` for one toolbar felt like the wrong
 * trade-off — see the sprint report for this call.
 */
const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

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

export interface FilterToolbarProps {
  filters: InvestigationFilters;
  onFiltersChange: (filters: InvestigationFilters) => void;
  /** Unique provider names for the dropdown — see getUniqueProviders in lib/eventFilters.ts. */
  providers: string[];
  /** Unique computer/hostnames for the dropdown — see getUniqueComputers in lib/eventFilters.ts. */
  computers: string[];
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Investigation-wide search & filter bar for the dashboard. Purely
 * presentational and controlled: every field reflects `filters` and
 * reports changes via `onFiltersChange`. The only logic that lives here is
 * UI-timing (debouncing the search box) and turning raw input events into
 * typed values (`parseEventIdInput`) — matching/aggregation itself is done
 * by `filterEvents` in lib/eventFilters.ts, not here.
 */
export function FilterToolbar({
  filters,
  onFiltersChange,
  providers,
  computers,
  className,
}: FilterToolbarProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search);

  // Tracks the last external `filters.search` value this component has
  // already synced against, so the check below only fires on a genuine
  // outside change (e.g. Clear Filters), not on every render.
  const [syncedSearch, setSyncedSearch] = React.useState(filters.search);

  // React's own recommended pattern for "adjust local state when a prop
  // changes" (see react.dev/learn/you-might-not-need-an-effect) — calling
  // setState directly in the render body like this is explicitly supported:
  // React re-renders immediately, before the browser paints, so there's no
  // extra visible frame and no `useEffect` involved. This replaces what
  // would otherwise be a `setSearchInput(filters.search)` inside a
  // `useEffect(() => ..., [filters.search])`, which the project's
  // React-Compiler-aware lint rules (react-hooks/set-state-in-effect) flag
  // as a cascading-render risk.
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setSearchInput(filters.search);
  }

  // Refs so the debounced callback below always sees the latest props when
  // it actually fires, without re-running/resetting the debounce timer on
  // every unrelated filter change. Assigning `.current` must happen in an
  // effect, not during render (react-hooks/refs) — this runs after every
  // commit, with no dependency array.
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

  const handleClear = () => {
    if (debounceHandle.current) clearTimeout(debounceHandle.current);
    setSearchInput("");
    onFiltersChange({ search: "", provider: null, computer: null, eventId: null, level: "All" });
  };

  const active = hasActiveFilters(filters);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <FilterField label="Search" htmlFor="filter-search" className="lg:col-span-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="filter-search"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Event ID, provider, computer, user, message…"
              className="pl-8"
            />
          </div>
        </FilterField>

        <FilterField label="Provider" htmlFor="filter-provider">
          <select
            id="filter-provider"
            className={selectClassName}
            value={filters.provider ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, provider: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="">All Providers</option>
            {providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Computer" htmlFor="filter-computer">
          <select
            id="filter-computer"
            className={selectClassName}
            value={filters.computer ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, computer: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="">All Computers</option>
            {computers.map((computer) => (
              <option key={computer} value={computer}>
                {computer}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Event ID" htmlFor="filter-event-id">
          <div className="relative">
            <Hash
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="filter-event-id"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={filters.eventId ?? ""}
              onChange={(e) =>
                onFiltersChange({ ...filters, eventId: parseEventIdInput(e.target.value) })
              }
              placeholder="All Event IDs"
              className="pl-8"
            />
          </div>
        </FilterField>

        <FilterField label="Level" htmlFor="filter-level">
          <select
            id="filter-level"
            className={selectClassName}
            value={filters.level}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                level: e.target.value as InvestigationFilters["level"],
              })
            }
          >
            {LEVEL_FILTER_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </FilterField>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" disabled={!active} onClick={handleClear} className="gap-1.5">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
