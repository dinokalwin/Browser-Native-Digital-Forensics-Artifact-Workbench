import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { SearchX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EvtxEvent } from "@/types/evidence";
import { useFilterStore } from "@/store/filterStore";
import { useUIStore } from "@/store/uiStore";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { columns } from "@/components/evidence/columns";
import { EvidenceTableToolbar } from "@/components/evidence/EvidenceTableToolbar";
import { EvidenceTablePagination } from "@/components/evidence/EvidenceTablePagination";
import { EvidenceTableSkeleton } from "@/components/evidence/EvidenceTableSkeleton";

interface EvidenceTableProps {
  data: EvtxEvent[];
  isLoading?: boolean;
}

/**
 * Professional evidence grid: search + column filters + sorting +
 * pagination + row selection, backed by TanStack Table.
 *
 * State is split deliberately:
 *  - search / column filters / sort / pagination live in `filterStore`
 *    (Phase 2's view-state store) so they persist across navigating away
 *    from and back to this page.
 *  - row selection is local, ephemeral component state — it's specific
 *    to a single table render and shouldn't outlive it.
 *  - clicking a row (outside the checkbox) sets `uiStore.selectedEvent`,
 *    the cross-panel link that a future detail view / timeline
 *    highlight will read from.
 */
export function EvidenceTable({ data, isLoading = false }: EvidenceTableProps) {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const activeFilters = useFilterStore((s) => s.activeFilters);
  const sorting = useFilterStore((s) => s.sorting);
  const setSorting = useFilterStore((s) => s.setSorting);
  const pagination = useFilterStore((s) => s.pagination);
  const setPagination = useFilterStore((s) => s.setPagination);

  const selectedEvent = useUIStore((s) => s.selectedEvent);
  const selectEvent = useUIStore((s) => s.selectEvent);

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const filteredData = React.useMemo(() => {
    return data.filter((event) => {
      if (activeFilters.level && event.level !== activeFilters.level) return false;
      if (activeFilters.provider && event.provider !== activeFilters.provider) return false;
      return true;
    });
  }, [data, activeFilters]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      globalFilter: searchQuery,
    },
    getRowId: (row) => row.id,
    onSortingChange: (updater) =>
      setSorting(typeof updater === "function" ? updater(sorting) : updater),
    onPaginationChange: (updater) =>
      setPagination(typeof updater === "function" ? updater(pagination) : updater),
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: () => {
      /* handled via setSearchQuery in the toolbar; ignored here */
    },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const query = filterValue.trim().toLowerCase();
      if (!query) return true;
      const event = row.original;
      return [
        event.timestamp,
        String(event.eventId),
        event.level,
        event.provider,
        event.computer,
        event.user,
        event.message,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const selectedCount = Object.keys(rowSelection).length;
  const visibleEvents = React.useMemo(
    () => table.getFilteredRowModel().rows.map((r) => r.original),
    [table, filteredData, searchQuery],
  );

  return (
    // Same `min-w-0` reasoning as CaseStateGate.tsx: this is itself a
    // flex-col container, so the `rounded-lg border` div below (wrapping
    // <Table>, which has real per-column min-width — see columns.tsx) is
    // a flex item that would otherwise refuse to shrink below the
    // table's intrinsic width, pushing this whole component wider than
    // whatever bounded width its parent gives it. `min-w-0` here plus
    // `[&>*]:min-w-0` on children is what lets Table's own
    // `overflow-x-auto` wrapper (src/components/ui/table.tsx) actually
    // scroll locally instead of the page growing to fit it.
    <div className="flex min-w-0 flex-col gap-4 [&>*]:min-w-0">
      <EvidenceTableToolbar
        data={data}
        visibleEvents={visibleEvents}
        selectedCount={selectedCount}
        totalCount={visibleEvents.length}
      />

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {table.getHeaderGroups()[0].headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.columnDef.meta?.className}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : header.column.getCanSort()
                          ? "none"
                          : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody aria-busy={isLoading}>
            {isLoading ? (
              <EvidenceTableSkeleton columnCount={columns.length} rowCount={pagination.pageSize} />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 py-10">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <SearchX className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="font-medium text-foreground">No matching events</p>
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Try adjusting your search or clearing the active filters.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={() => selectEvent(row.original)}
                  className={cn(
                    "cursor-pointer",
                    selectedEvent?.id === row.original.id && "bg-primary/5",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EvidenceTablePagination table={table} />
    </div>
  );
}
