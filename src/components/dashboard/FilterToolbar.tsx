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
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Tailwind classes for the native `<select>` elements below, matching
 * `Input`'s visual treatment (src/components/ui/input.tsx) so the toolbar
 * reads as one design system even though this project doesn't have a
 * shadcn/Radix `Select` primitive yet (only `dropdown-menu.tsx`, which is
 * built for menus/actions, not a bound `<select>`-style form control).
 * Introducing `@radix-ui/react-select` for one toolbar felt like the wrong
 * trade-off — see the sprint report for this call.
 *
 * `bg-background` (rather than Input's `bg-transparent`) is intentional
 * here: it's the same token, but explicit rather than inherited, so the
 * closed control's color unambiguously tracks the active theme even if
 * some future ancestor's background changes.
 */
const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Tailwind classes for each `<option>`. The *open* popup a native
 * `<select>` renders is drawn by the OS/browser widget layer, not this
 * component's own DOM — Tailwind classes on the `<select>` itself only
 * ever reach the closed control. `color-scheme` (set per-theme in
 * index.css) is what makes the popup follow the app's dark/light palette
 * at the browser-chrome level; these `bg-popover`/`text-foreground`
 * classes are the belt-and-braces second layer some browsers (notably
 * Firefox) additionally honor for `<option>` background/text directly.
 * `checked:` targets the currently-selected option as the closest native
 * equivalent to "selected option: primary color" a `<select>` supports.
 */
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

export interface FilterToolbarProps {
  filters: InvestigationFilters;
  onFiltersChange: (filters: InvestigationFilters) => void;
  /** Unique provider names for the dropdown — see getUniqueProviders in lib/eventFilters.ts. */
  providers: string[];
  /** Unique computer/hostnames for the dropdown — see getUniqueComputers in lib/eventFilters.ts. */
  computers: string[];
  /**
   * "Bookmarked Only" (Sprint 4.2) — deliberately NOT part of
   * `InvestigationFilters`/`onFiltersChange`: bookmarks are a separate
   * concern from `lib/eventFilters.ts` (the filtering engine, out of
   * scope for that sprint), applied as an additional narrowing step by
   * the caller on top of whatever `filterEvents` already returned. Both
   * optional so this toolbar still works exactly as before for any
   * caller that doesn't pass them.
   */
  bookmarkedOnly?: boolean;
  onBookmarkedOnlyChange?: (value: boolean) => void;
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
  bookmarkedOnly = false,
  onBookmarkedOnlyChange,
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
    onBookmarkedOnlyChange?.(false);
  };

  const active = hasActiveFilters(filters) || bookmarkedOnly;

  return (
    // No border/shadow/background of its own — this toolbar lives inside
    // DashboardPage's unified "All Events" Card, so its own bordered box
    // would just recreate the "boxes inside boxes" look these sprints set
    // out to remove. Two rows, matching the ticket's desired layout: the
    // investigation search bar gets a full-width row of its own (it's the
    // primary, most-used control and should read as visually dominant,
    // not compete for space with four dropdowns), then Provider/Computer/
    // Event ID/Level plus Clear Filters share a second `flex-wrap` row —
    // each field carries its own `min-w`, so that row holds a single line
    // at wide desktop widths, wraps naturally as space runs out at
    // laptop/tablet widths, and stacks one field per line on mobile,
    // without hand-tuning a column count per breakpoint.
    <div className={cn("flex flex-col gap-4", className)}>
      <FilterField label="Search Events" htmlFor="filter-search">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="filter-search"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search by event ID, provider, computer, user, or message…"
            className="h-10 pl-9 text-sm"
          />
        </div>
      </FilterField>

      <div className="flex flex-wrap items-end gap-4">
        <FilterField label="Provider" htmlFor="filter-provider" className="min-w-[160px] flex-1">
          <select
            id="filter-provider"
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

        <FilterField label="Computer" htmlFor="filter-computer" className="min-w-[160px] flex-1">
          <select
            id="filter-computer"
            className={selectClassName}
            aria-label="Filter by computer"
            value={filters.computer ?? ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, computer: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="" className={optionClassName}>
              All Computers
            </option>
            {computers.map((computer) => (
              <option key={computer} value={computer} className={optionClassName}>
                {computer}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Event ID" htmlFor="filter-event-id" className="min-w-[140px] flex-1">
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

        <FilterField label="Level" htmlFor="filter-level" className="min-w-[140px] flex-1">
          <select
            id="filter-level"
            className={selectClassName}
            aria-label="Filter by level"
            value={filters.level}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                level: e.target.value as InvestigationFilters["level"],
              })
            }
          >
            {LEVEL_FILTER_OPTIONS.map((level) => (
              <option key={level} value={level} className={optionClassName}>
                {level}
              </option>
            ))}
          </select>
        </FilterField>

        {onBookmarkedOnlyChange && (
          <label
            htmlFor="filter-bookmarked-only"
            className="flex h-9 items-center gap-2 text-sm text-foreground"
          >
            <Checkbox
              id="filter-bookmarked-only"
              checked={bookmarkedOnly}
              onCheckedChange={(value) => onBookmarkedOnlyChange(value === true)}
            />
            Bookmarked Only
          </label>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={!active}
          onClick={handleClear}
          className="ml-auto gap-1.5"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
