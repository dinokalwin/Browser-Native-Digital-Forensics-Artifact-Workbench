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
import { useVirtualizer } from "@tanstack/react-virtual";
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

/**
 * Phase 4 — Performance at Scale (SDD §20/§25 Phase 10, §7 Nice to Have
 * "Virtualized table rendering for very large event sets (100k+ rows)").
 * Matches `TableCell`'s `py-3` (12px top+bottom) plus `text-sm` line-height
 * (ui/table.tsx) — every column in columns.tsx renders a single-line,
 * `truncate`d value, never wrapping text, so this fixed estimate is exact
 * rather than approximate; there's no need for `@tanstack/react-virtual`'s
 * dynamic `measureElement` re-measurement here.
 */
const ROW_HEIGHT_PX = 45;

interface EvidenceTableProps {
  data: EvtxEvent[];
  isLoading?: boolean;
  /**
   * Called on row click (outside the checkbox), in addition to the
   * existing `uiStore.selectEvent` call below — this is what
   * DashboardPage's Event Details Inspector (EventDetailsDrawer.tsx) uses
   * to open on a row click, keeping that drawer's `selectedEvent` as
   * local React state per that feature's design, without touching or
   * replacing the pre-existing `uiStore.selectedEvent` cross-panel link
   * (still what drives this table's own row-highlight styling below).
   */
  onRowClick?: (event: EvtxEvent) => void;
  /**
   * Whether to render the built-in `EvidenceTableToolbar` (search/level/
   * provider dropdowns + export + selection count). Defaults to `true` so
   * every existing consumer — most notably EvidenceViewerPage
   * (`/dashboard/evidence`), which has no other filter/export UI of its
   * own — keeps behaving exactly as before. DashboardPage (Sprint 3.4.1)
   * passes `false` because its "All Events" card now supplies an
   * equivalent FilterToolbar + results/export row itself, and rendering
   * both would duplicate controls that write to the same `filterStore`
   * state (see SuspiciousEventsPanel's "go to event" deep link, which
   * still depends on that store regardless of whether this toolbar is
   * visible).
   */
  showToolbar?: boolean;
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
 *    highlight will read from, and (if provided) calls `onRowClick`.
 *
 * Wrapped in `React.memo` (see the bottom of this file) so that state
 * changes elsewhere on the dashboard — most notably the Event Details
 * Inspector opening/closing — don't re-render this table: with 50,000+
 * rows behind TanStack Table, that render is real work worth skipping
 * when none of this component's own props actually changed.
 *
 * Row rendering is virtualized (Phase 4 — Performance at Scale) via
 * `@tanstack/react-virtual`'s `useVirtualizer`, scoped purely to the DOM
 * layer: it changes nothing about `useReactTable`'s state, sorting,
 * filtering, selection, or pagination row model — `rowVirtualizer` just
 * decides which of the *already-computed* `rows` get a real `<TableRow>`
 * mounted at any given scroll position, using two spacer `<tr>`s (real
 * `<table>` semantics preserved, per SDD §21) to hold the correct
 * scrollable height for the rest. Pagination (`EvidenceTablePagination`)
 * is unchanged and still caps `rows.length` at the selected page size
 * (max 100) — virtualization on top of that is a real, if modest, DOM-node
 * reduction today (≤100 mounted rows → typically ~30 with the current
 * viewport/overscan), and is what makes raising that page-size cap safe
 * to consider later without a DOM-bloat regression.
 */
function EvidenceTableImpl({
  data,
  isLoading = false,
  onRowClick,
  showToolbar = true,
}: EvidenceTableProps) {
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

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualTotalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? virtualTotalSize - virtualRows[virtualRows.length - 1].end : 0;

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
      {showToolbar && (
        <EvidenceTableToolbar
          data={data}
          visibleEvents={visibleEvents}
          selectedCount={selectedCount}
          totalCount={visibleEvents.length}
        />
      )}

      {/* Bounded height + its own vertical scroll so TableHeader's
          `sticky top-0` (ui/table.tsx) has a scrolling ancestor to stick
          within — self-contained, so it doesn't depend on (or need to
          coordinate z-index/offset with) AppShell's own sticky navbar. */}
      <div
        ref={scrollContainerRef}
        className="max-h-[32rem] overflow-y-auto rounded-lg border border-border"
      >
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
              <>
                {/* Top spacer — holds the scroll height of every row above
                    the virtualized window, so scrollbar size/position stay
                    correct without those rows actually being mounted. */}
                {paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: paddingTop, padding: 0 }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      onClick={() => {
                        selectEvent(row.original);
                        onRowClick?.(row.original);
                      }}
                      className={cn(
                        "cursor-pointer",
                        selectedEvent?.id === row.original.id &&
                          "bg-primary/10 hover:bg-primary/15",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {/* Bottom spacer — same reasoning, for every row below the
                    virtualized window. */}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: paddingBottom, padding: 0 }} />
                  </tr>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <EvidenceTablePagination table={table} />
    </div>
  );
}

export const EvidenceTable = React.memo(EvidenceTableImpl);
