import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Column } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import type { EvtxEvent } from "@/types/evidence";

interface SortableHeaderProps {
  column: Column<EvtxEvent, unknown>;
  label: string;
  className?: string;
}

/**
 * Clickable column header that toggles asc/desc/none sort state and
 * reflects it both visually (icon) and to assistive tech (aria-sort on
 * the parent <th>, set by the caller — see columns.tsx).
 */
export function SortableHeader({ column, label, className }: SortableHeaderProps) {
  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {label}
      {sorted === "asc" && <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
      {sorted === "desc" && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {!sorted && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />}
    </button>
  );
}
