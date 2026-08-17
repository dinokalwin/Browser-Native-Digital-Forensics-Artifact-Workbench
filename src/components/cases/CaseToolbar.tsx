import { LayoutGrid, List, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { CASE_SORT_LABEL, type CaseSortOrder, type CaseViewMode } from "@/lib/cases/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Matches `MitreFilterToolbar.tsx`'s (and, before that, `FilterToolbar.tsx`'s)
 * native `<select>` treatment exactly, so the Case Library's toolbar reads
 * as the same control family as every other filter/sort row in this app —
 * a small, deliberate duplication of the same class strings rather than an
 * import, matching those two files' own precedent for this exact reuse
 * decision. */
const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";
const optionClassName = "bg-popover text-foreground checked:bg-primary checked:text-primary-foreground";

const SORT_ORDERS: CaseSortOrder[] = ["newest", "oldest", "highest-threat", "most-events"];

interface CaseToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortOrder: CaseSortOrder;
  onSortOrderChange: (value: CaseSortOrder) => void;
  viewMode: CaseViewMode;
  onViewModeChange: (value: CaseViewMode) => void;
}

/**
 * Case Library toolbar (Phase 5.10) — Search, Sort (Newest / Oldest /
 * Highest Threat / Most Events), and a Grid/List view toggle. Purely
 * controlled/presentational: `CasesPage` owns the actual search/sort/view
 * state and passes the filtered+sorted result down, the same
 * "`lib/*` does the filtering, the toolbar only reports intent" split
 * `MitreFilterToolbar.tsx`/`FilterToolbar.tsx` already establish.
 */
export function CaseToolbar({
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
}: CaseToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <label htmlFor="case-search" className="text-xs font-medium text-muted-foreground">
          Search Cases
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="case-search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by case name or source file…"
            className="h-10 pl-9 text-sm"
          />
        </div>
      </div>

      <div className="flex min-w-[180px] flex-col gap-1.5">
        <label htmlFor="case-sort" className="text-xs font-medium text-muted-foreground">
          Sort
        </label>
        <select
          id="case-sort"
          className={selectClassName}
          aria-label="Sort cases"
          value={sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value as CaseSortOrder)}
        >
          {SORT_ORDERS.map((order) => (
            <option key={order} value={order} className={optionClassName}>
              {CASE_SORT_LABEL[order]}
            </option>
          ))}
        </select>
      </div>

      <div
        role="group"
        aria-label="Case Library view"
        className="flex h-9 items-center gap-0.5 rounded-md border border-input bg-background p-0.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={viewMode === "grid"}
          aria-label="Grid view"
          title="Grid view"
          onClick={() => onViewModeChange("grid")}
          className={cn("h-7 w-7", viewMode === "grid" && "bg-primary/10 text-primary hover:bg-primary/15")}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={viewMode === "list"}
          aria-label="List view"
          title="List view"
          onClick={() => onViewModeChange("list")}
          className={cn("h-7 w-7", viewMode === "list" && "bg-primary/10 text-primary hover:bg-primary/15")}
        >
          <List className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
