import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EvtxEvent } from "@/types/evidence";
import { getUniqueComputers, getUniqueProviders } from "@/lib/eventFilters";
import {
  DEFAULT_SEARCH_FILTERS,
  SEARCH_RESULT_TYPE_LABEL,
  SEARCH_RESULT_TYPE_ORDER,
  hasActiveSearchFilters,
  type SearchFilters as SearchFiltersState,
} from "@/lib/search/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** Matches `MitreFilterToolbar.tsx`'s (and, before that, the dashboard
 * `FilterToolbar.tsx`'s) native `<select>` treatment exactly — the same
 * small, deliberate duplication of those class strings those two files
 * already chose over importing an unexported constant from either. */
const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";
const optionClassName = "bg-popover text-foreground checked:bg-primary checked:text-primary-foreground";

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
  /** Raw events, used only to derive the Provider/Computer dropdown
   * options via `lib/eventFilters.ts`'s existing helpers — this component
   * never filters `events` itself, that stays entirely inside
   * `searchEngine.ts#matchesFilters`. */
  events: readonly EvtxEvent[];
  /** Every MITRE technique ID currently observed in the index
   * (`SearchIndex.byTechniqueId`'s key set) — populates the Technique
   * dropdown with only techniques that could actually match something. */
  techniqueIds: readonly string[];
  className?: string;
}

/**
 * Filter row for Global Investigation Search (ticket "11. SEARCH
 * FILTERS") — Type / Provider / Computer / Event Level / IOC Severity /
 * MITRE Technique dropdowns plus Bookmarked Only / Notes Only toggles,
 * all combining via AND (enforced in `searchEngine.ts#matchesFilters`, not
 * here). Purely controlled and presentational, following the exact same
 * shape `MitreFilterToolbar.tsx` already established for this project's
 * other advanced filter row.
 */
export function SearchFilters({ filters, onFiltersChange, events, techniqueIds, className }: SearchFiltersProps) {
  const providers = React.useMemo(() => getUniqueProviders(events), [events]);
  const computers = React.useMemo(() => getUniqueComputers(events), [events]);
  const sortedTechniqueIds = React.useMemo(() => [...techniqueIds].sort((a, b) => a.localeCompare(b)), [techniqueIds]);

  const active = hasActiveSearchFilters(filters);

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end", className)}>
      <div className="flex min-w-[150px] flex-col gap-1.5">
        <label htmlFor="search-filter-type" className="text-xs font-medium text-muted-foreground">
          Type
        </label>
        <select
          id="search-filter-type"
          className={selectClassName}
          aria-label="Filter by result type"
          value={filters.type}
          onChange={(e) => onFiltersChange({ ...filters, type: e.target.value as SearchFiltersState["type"] })}
        >
          <option value="all" className={optionClassName}>
            All Types
          </option>
          {SEARCH_RESULT_TYPE_ORDER.map((type) => (
            <option key={type} value={type} className={optionClassName}>
              {SEARCH_RESULT_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[170px] flex-col gap-1.5">
        <label htmlFor="search-filter-provider" className="text-xs font-medium text-muted-foreground">
          Provider
        </label>
        <select
          id="search-filter-provider"
          className={selectClassName}
          aria-label="Filter by provider"
          value={filters.provider ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, provider: e.target.value === "" ? null : e.target.value })}
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
      </div>

      <div className="flex min-w-[170px] flex-col gap-1.5">
        <label htmlFor="search-filter-computer" className="text-xs font-medium text-muted-foreground">
          Computer
        </label>
        <select
          id="search-filter-computer"
          className={selectClassName}
          aria-label="Filter by computer"
          value={filters.computer ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, computer: e.target.value === "" ? null : e.target.value })}
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
      </div>

      <div className="flex min-w-[150px] flex-col gap-1.5">
        <label htmlFor="search-filter-level" className="text-xs font-medium text-muted-foreground">
          Event Level
        </label>
        <select
          id="search-filter-level"
          className={selectClassName}
          aria-label="Filter by event level"
          value={filters.level ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, level: e.target.value === "" ? null : (e.target.value as SearchFiltersState["level"]) })
          }
        >
          <option value="" className={optionClassName}>
            All Levels
          </option>
          <option value="Critical" className={optionClassName}>
            Critical
          </option>
          <option value="Error" className={optionClassName}>
            Error
          </option>
          <option value="Warning" className={optionClassName}>
            Warning
          </option>
          <option value="Information" className={optionClassName}>
            Information
          </option>
          <option value="Verbose" className={optionClassName}>
            Verbose
          </option>
        </select>
      </div>

      <div className="flex min-w-[150px] flex-col gap-1.5">
        <label htmlFor="search-filter-severity" className="text-xs font-medium text-muted-foreground">
          IOC Severity
        </label>
        <select
          id="search-filter-severity"
          className={selectClassName}
          aria-label="Filter by IOC severity"
          value={filters.severity ?? ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              severity: e.target.value === "" ? null : (e.target.value as SearchFiltersState["severity"]),
            })
          }
        >
          <option value="" className={optionClassName}>
            All Severities
          </option>
          <option value="critical" className={optionClassName}>
            Critical
          </option>
          <option value="warning" className={optionClassName}>
            Warning
          </option>
          <option value="informational" className={optionClassName}>
            Informational
          </option>
        </select>
      </div>

      <div className="flex min-w-[180px] flex-col gap-1.5">
        <label htmlFor="search-filter-technique" className="text-xs font-medium text-muted-foreground">
          MITRE Technique
        </label>
        <select
          id="search-filter-technique"
          className={selectClassName}
          aria-label="Filter by MITRE technique"
          value={filters.mitreTechnique ?? ""}
          onChange={(e) => onFiltersChange({ ...filters, mitreTechnique: e.target.value === "" ? null : e.target.value })}
        >
          <option value="" className={optionClassName}>
            All Techniques
          </option>
          {sortedTechniqueIds.map((id) => (
            <option key={id} value={id} className={optionClassName}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-row flex-wrap items-center gap-4 sm:gap-5">
        <label htmlFor="search-filter-bookmarked" className="flex h-9 items-center gap-2 text-sm text-foreground">
          <Checkbox
            id="search-filter-bookmarked"
            checked={filters.bookmarkedOnly}
            onCheckedChange={(value) => onFiltersChange({ ...filters, bookmarkedOnly: value === true })}
          />
          Bookmarked Only
        </label>
        <label htmlFor="search-filter-notes" className="flex h-9 items-center gap-2 text-sm text-foreground">
          <Checkbox
            id="search-filter-notes"
            checked={filters.notesOnly}
            onCheckedChange={(value) => onFiltersChange({ ...filters, notesOnly: value === true })}
          />
          Notes Only
        </label>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!active}
        onClick={() => onFiltersChange(DEFAULT_SEARCH_FILTERS)}
        className="gap-1.5"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Clear Filters
      </Button>
    </div>
  );
}
