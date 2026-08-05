import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreTechniqueSummary } from "@/lib/mitre/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MitreTechniqueTableProps {
  techniques: MitreTechniqueSummary[];
  onSelectTechnique: (technique: MitreTechniqueSummary) => void;
}

type SortField = "name" | "id" | "tactic" | "findingCount" | "severity";
type SortDirection = "asc" | "desc";

const SEVERITY_VARIANT: Record<DetectionFinding["severity"], NonNullable<BadgeProps["variant"]>> = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
};

const SEVERITY_RANK: Record<DetectionFinding["severity"], number> = {
  critical: 3,
  warning: 2,
  informational: 1,
};

interface TableSortButtonProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

/**
 * Small local sortable-header button matching `SortableHeader.tsx`'s exact
 * visual language (same icons/hover treatment) without depending on that
 * component's hardcoded `Column<EvtxEvent, unknown>` type — this table
 * uses plain local sort state (13 rows at most; TanStack Table's
 * pagination/virtualization machinery would be pure overhead here), so
 * reusing `SortableHeader` as-is isn't possible without widening its
 * generic, and this sprint's own "only modify what's needed" instruction
 * favors a small local component over changing a shared one two other
 * pages already depend on.
 */
function TableSortButton({ label, field, sortField, sortDirection, onSort }: TableSortButtonProps) {
  const sorted = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
      {sorted && sortDirection === "asc" && <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
      {sorted && sortDirection === "desc" && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {!sorted && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />}
    </button>
  );
}

/**
 * Technique Table (Sprint 5.9.1, Step 8) — sortable, and clickable (search
 * itself lives in `MitreFilterToolbar`/`lib/mitre/statistics.ts#filterMitreTechniques`
 * upstream; this component only sorts and renders whatever `techniques`
 * it's handed). Clicking a row calls `onSelectTechnique`, which
 * `MitreAttackPage.tsx` uses to open `MitreFindingDrawer` — the same
 * "row click opens a detail drawer" interaction `EvidenceTable` already
 * establishes for events.
 */
export function MitreTechniqueTable({ techniques, onSelectTechnique }: MitreTechniqueTableProps) {
  const [sortField, setSortField] = React.useState<SortField>("findingCount");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sorted = React.useMemo(() => {
    const copy = techniques.slice();
    const dir = sortDirection === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "id":
          return a.id.localeCompare(b.id) * dir;
        case "tactic":
          return a.tactic.localeCompare(b.tactic) * dir;
        case "findingCount":
          return (a.findingCount - b.findingCount) * dir;
        case "severity": {
          const rankA = a.highestSeverity ? SEVERITY_RANK[a.highestSeverity] : 0;
          const rankB = b.highestSeverity ? SEVERITY_RANK[b.highestSeverity] : 0;
          return (rankA - rankB) * dir;
        }
        default:
          return 0;
      }
    });
    return copy;
  }, [techniques, sortField, sortDirection]);

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <TableSortButton label="Technique" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead className="w-32">
              <TableSortButton label="Technique ID" field="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead className="hidden md:table-cell">
              <TableSortButton label="Tactic" field="tactic" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead className="w-24">
              <TableSortButton label="Findings" field="findingCount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead className="w-28">
              <TableSortButton label="Severity" field="severity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead className="hidden min-w-56 lg:table-cell">Recommendation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                No techniques match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((technique) => (
              <TableRow
                key={technique.id}
                tabIndex={0}
                aria-label={`View details for ${technique.name}`}
                onClick={() => onSelectTechnique(technique)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTechnique(technique);
                  }
                }}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <TableCell className="max-w-64">
                  <span className="block truncate font-medium text-foreground" title={technique.name}>
                    {technique.name}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{technique.id}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-foreground">{technique.tactic}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono tabular-nums text-foreground">{technique.findingCount}</span>
                </TableCell>
                <TableCell>
                  {technique.highestSeverity && (
                    <Badge variant={SEVERITY_VARIANT[technique.highestSeverity]} className="capitalize">
                      {technique.highestSeverity}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span
                    className={cn("block max-w-md truncate text-xs text-muted-foreground")}
                    title={technique.recommendation}
                  >
                    {technique.recommendation}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
