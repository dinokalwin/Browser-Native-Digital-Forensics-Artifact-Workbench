import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { MITRE_TACTICS } from "@/lib/mitre/mapping";
import { DEFAULT_MITRE_FILTERS, type MitreFilters, type MitreTechniqueSummary } from "@/lib/mitre/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** Matches FilterToolbar.tsx's (dashboard/FilterToolbar.tsx) native
 * `<select>` treatment exactly, so this page's filter row reads as the
 * same control family as the Overview dashboard's — that file's own
 * styling constants aren't exported, so this is a small, deliberate
 * duplication of the same class strings rather than an import, per this
 * sprint's "reuse existing design language" (visual language) rather than
 * "import internals from another feature's component". */
const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";
const optionClassName = "bg-popover text-foreground checked:bg-primary checked:text-primary-foreground";

interface MitreFilterToolbarProps {
  filters: MitreFilters;
  onFiltersChange: (filters: MitreFilters) => void;
  /** Sprint 5.9.2 — every currently *observed* technique, used only to
   * populate the Technique dropdown's options (id + name). Not the full
   * `MITRE_TECHNIQUES` reference table — filtering to a technique that was
   * never observed would just always produce an empty table, so only
   * observed techniques are offered. */
  techniques?: MitreTechniqueSummary[];
  className?: string;
}

/**
 * Search + Tactic + Severity filter row for the Technique Table / Coverage
 * Matrix (Sprint 5.9.1). Purely presentational and controlled: reflects
 * `filters` and reports changes via `onFiltersChange` — matching
 * `filterEvents`/`filterMitreTechniques`'s pattern of the filtering logic
 * itself living in `lib/*`, not here. No debounce: with at most a handful
 * of known techniques, filtering is effectively free, so there's no
 * perf reason to add the timing complexity the dashboard's search box
 * needs for its much larger event table.
 *
 * Sprint 5.9.2 — Advanced Filters: adds a Technique dropdown (the same
 * selection the Coverage Matrix/charts/table row-click drive — this just
 * offers it as a fourth, keyboard-first entry point) and two checkboxes,
 * "Has Recommendation" / "Has Events". Search now also matches
 * recommendations and finding text (see `lib/mitre/statistics.ts#filterMitreTechniques`'s
 * doc comment) — the placeholder copy below is updated to say so.
 */
export function MitreFilterToolbar({ filters, onFiltersChange, techniques = [], className }: MitreFilterToolbarProps) {
  const active =
    filters.search.trim() !== "" ||
    filters.tactic !== "All" ||
    filters.severity !== "All" ||
    filters.technique !== "All" ||
    filters.hasRecommendation ||
    filters.hasEvents;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end", className)}>
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <label htmlFor="mitre-search" className="text-xs font-medium text-muted-foreground">
          Search Techniques
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="mitre-search"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search techniques, tactics, recommendations, IOC findings…"
            className="h-10 pl-9 text-sm"
          />
        </div>
      </div>

      <div className="flex min-w-[180px] flex-col gap-1.5">
        <label htmlFor="mitre-tactic" className="text-xs font-medium text-muted-foreground">
          Tactic
        </label>
        <select
          id="mitre-tactic"
          className={selectClassName}
          aria-label="Filter by MITRE tactic"
          value={filters.tactic}
          onChange={(e) => onFiltersChange({ ...filters, tactic: e.target.value as MitreFilters["tactic"] })}
        >
          <option value="All" className={optionClassName}>
            All Tactics
          </option>
          {MITRE_TACTICS.map((tactic) => (
            <option key={tactic} value={tactic} className={optionClassName}>
              {tactic}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[160px] flex-col gap-1.5">
        <label htmlFor="mitre-severity" className="text-xs font-medium text-muted-foreground">
          Severity
        </label>
        <select
          id="mitre-severity"
          className={selectClassName}
          aria-label="Filter by severity"
          value={filters.severity}
          onChange={(e) => onFiltersChange({ ...filters, severity: e.target.value as MitreFilters["severity"] })}
        >
          <option value="All" className={optionClassName}>
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
        <label htmlFor="mitre-technique" className="text-xs font-medium text-muted-foreground">
          Technique
        </label>
        <select
          id="mitre-technique"
          className={selectClassName}
          aria-label="Filter by MITRE technique"
          value={filters.technique}
          onChange={(e) => onFiltersChange({ ...filters, technique: e.target.value })}
        >
          <option value="All" className={optionClassName}>
            All Techniques
          </option>
          {techniques.map((technique) => (
            <option key={technique.id} value={technique.id} className={optionClassName}>
              {technique.id} — {technique.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-row flex-wrap items-center gap-4 sm:gap-5">
        <label htmlFor="mitre-has-recommendation" className="flex h-9 items-center gap-2 text-sm text-foreground">
          <Checkbox
            id="mitre-has-recommendation"
            checked={filters.hasRecommendation}
            onCheckedChange={(value) => onFiltersChange({ ...filters, hasRecommendation: value === true })}
          />
          Has Recommendation
        </label>
        <label htmlFor="mitre-has-events" className="flex h-9 items-center gap-2 text-sm text-foreground">
          <Checkbox
            id="mitre-has-events"
            checked={filters.hasEvents}
            onCheckedChange={(value) => onFiltersChange({ ...filters, hasEvents: value === true })}
          />
          Has Events
        </label>
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={!active}
        onClick={() => onFiltersChange(DEFAULT_MITRE_FILTERS)}
        className="gap-1.5"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Clear Filters
      </Button>
    </div>
  );
}
