import * as React from "react";
import { Search, X, ListFilter } from "lucide-react";

import type { EvtxEvent, EventLevel } from "@/types/evidence";
import { useFilterStore } from "@/store/filterStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportControls } from "@/components/evidence/ExportControls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LEVELS: EventLevel[] = ["Critical", "Error", "Warning", "Information", "Verbose"];

interface EvidenceTableToolbarProps {
  data: EvtxEvent[];
  /** Currently visible rows after search + column filters — what Export respects. */
  visibleEvents: EvtxEvent[];
  selectedCount: number;
  totalCount: number;
}

export function EvidenceTableToolbar({
  data,
  visibleEvents,
  selectedCount,
  totalCount,
}: EvidenceTableToolbarProps) {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const activeFilters = useFilterStore((s) => s.activeFilters);
  const setFilter = useFilterStore((s) => s.setFilter);
  const clearFilters = useFilterStore((s) => s.clearFilters);

  const providers = React.useMemo(
    () => Array.from(new Set(data.map((e) => e.provider))).sort(),
    [data],
  );

  const hasActiveFilters =
    Boolean(searchQuery) || Boolean(activeFilters.level) || Boolean(activeFilters.provider);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search timestamp, event ID, provider, computer, user, message…"
            aria-label="Search events"
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
                Level{activeFilters.level ? `: ${activeFilters.level}` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by level</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilter("level", null)}>
                All levels
              </DropdownMenuItem>
              {LEVELS.map((level) => (
                <DropdownMenuItem key={level} onClick={() => setFilter("level", level)}>
                  {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
                Provider
                {activeFilters.provider ? ": " + activeFilters.provider.split("-").pop() : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Filter by provider</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilter("provider", null)}>
                All providers
              </DropdownMenuItem>
              {providers.map((provider) => (
                <DropdownMenuItem key={provider} onClick={() => setFilter("provider", provider)}>
                  {provider}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {totalCount} event{totalCount === 1 ? "" : "s"}
          </span>
          {selectedCount > 0 && <Badge variant="secondary">{selectedCount} selected</Badge>}
        </div>
        <ExportControls events={visibleEvents} />
      </div>
    </div>
  );
}
