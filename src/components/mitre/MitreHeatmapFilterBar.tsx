import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { DEFAULT_MITRE_HEATMAP_FILTERS, type MitreHeatmapFilters, type MitreSeverityThreshold } from "@/lib/mitre/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface MitreHeatmapFilterBarProps {
  filters: MitreHeatmapFilters;
  onFiltersChange: (filters: MitreHeatmapFilters) => void;
  className?: string;
}

const THRESHOLD_OPTIONS: Array<{ value: MitreSeverityThreshold; label: string }> = [
  { value: "all", label: "All" },
  { value: "informational", label: "Informational+" },
  { value: "warning", label: "Warning+" },
  { value: "critical", label: "Critical only" },
];

/**
 * Heatmap Filters (Sprint 5.9.3, Step 5) — controls what the Heatmap
 * Matrix grid itself renders, independent of the Technique Table's own
 * cross-filters (see `MitreHeatmapFilters`'s doc comment in
 * `lib/mitre/types.ts` for why these are a separate controlled object).
 * Purely presentational/controlled, matching every other filter bar in
 * this feature (`MitreFilterToolbar`): reflects `filters`, reports changes
 * via `onFiltersChange`, no filtering logic of its own — that lives in
 * `lib/mitre/statistics.ts#applyHeatmapFilters`.
 *
 * The four severity-threshold options are a button group rather than a
 * `<select>` (unlike `MitreFilterToolbar`'s Tactic/Severity dropdowns):
 * with only four mutually-exclusive states meant to be flipped through
 * quickly while scanning the heatmap, inline toggle buttons keep the
 * current state visible at a glance instead of hidden behind a closed
 * dropdown.
 */
export function MitreHeatmapFilterBar({ filters, onFiltersChange, className }: MitreHeatmapFilterBarProps) {
  const active =
    filters.observedOnly || filters.severityThreshold !== "all" || filters.hideEmptyTechniques;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Severity</span>
        {THRESHOLD_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={filters.severityThreshold === option.value ? "default" : "outline"}
            className="h-7 px-2.5 text-xs"
            aria-pressed={filters.severityThreshold === option.value}
            onClick={() => onFiltersChange({ ...filters, severityThreshold: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label htmlFor="heatmap-observed-only" className="flex h-7 items-center gap-2 text-xs text-foreground">
          <Checkbox
            id="heatmap-observed-only"
            checked={filters.observedOnly}
            onCheckedChange={(value) => onFiltersChange({ ...filters, observedOnly: value === true })}
          />
          Observed only
        </label>
        <label htmlFor="heatmap-hide-empty" className="flex h-7 items-center gap-2 text-xs text-foreground">
          <Checkbox
            id="heatmap-hide-empty"
            checked={filters.hideEmptyTechniques}
            onCheckedChange={(value) => onFiltersChange({ ...filters, hideEmptyTechniques: value === true })}
          />
          Hide empty techniques
        </label>
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={!active}
        onClick={() => onFiltersChange(DEFAULT_MITRE_HEATMAP_FILTERS)}
        className="gap-1.5 sm:ml-auto"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Reset Heatmap
      </Button>
    </div>
  );
}
