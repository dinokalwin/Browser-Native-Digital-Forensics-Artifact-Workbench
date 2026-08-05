import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

import type { EvtxEvent } from "@/types/evidence";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableHeader } from "@/components/evidence/SortableHeader";
import { LevelBadge } from "@/components/evidence/level-badge";
import { NoteIndicator } from "@/components/evidence/NoteIndicator";
import { BookmarkIndicator } from "@/components/evidence/BookmarkIndicator";

/**
 * Column definitions for the Evidence Table. `meta.className` values are
 * applied to both the <TableHead> and <TableCell> for that column (see
 * EvidenceTable.tsx) and progressively hide lower-priority columns on
 * narrow viewports — the table remains horizontally scrollable as a
 * fallback so no data is ever unreachable, just deprioritized.
 */
export const columns: ColumnDef<EvtxEvent>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all events on this page"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select event ${row.original.id}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-10" },
  },
  {
    // Event Bookmarks (Sprint 4.2) — same "display-only id column" shape
    // as the notes column below; toggling happens in the Event Details
    // Drawer, not here.
    id: "bookmark",
    header: "",
    cell: ({ row }) => <BookmarkIndicator eventId={row.original.id} />,
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-8" },
  },
  {
    // Investigator Notes (Sprint 4.1) — a small icon, not a data field, so
    // this is an `id` column (no `accessorKey`) purely for display; sort/
    // filter/export behavior for every other column is untouched.
    id: "notes",
    header: "",
    cell: ({ row }) => <NoteIndicator eventId={row.original.id} />,
    enableSorting: false,
    enableHiding: false,
    meta: { className: "w-8" },
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => <SortableHeader column={column} label="Timestamp" />,
    cell: ({ getValue }) => {
      const iso = getValue<string>();
      return (
        <time dateTime={iso} title={iso} className="whitespace-nowrap tabular-nums text-foreground">
          {format(new Date(iso), "MMM d, yyyy HH:mm:ss")}
        </time>
      );
    },
    sortingFn: "datetime",
    meta: { className: "min-w-44" },
  },
  {
    accessorKey: "eventId",
    header: ({ column }) => <SortableHeader column={column} label="Event ID" />,
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-foreground">{getValue<number>()}</span>
    ),
    meta: { className: "w-20" },
  },
  {
    accessorKey: "level",
    header: ({ column }) => <SortableHeader column={column} label="Level" />,
    cell: ({ getValue }) => <LevelBadge level={getValue<EvtxEvent["level"]>()} />,
    meta: { className: "w-28" },
  },
  {
    accessorKey: "provider",
    header: ({ column }) => <SortableHeader column={column} label="Provider" />,
    cell: ({ getValue }) => (
      <span className="block max-w-56 truncate" title={getValue<string>()}>
        {getValue<string>()}
      </span>
    ),
    meta: { className: "hidden min-w-48 md:table-cell" },
  },
  {
    accessorKey: "computer",
    header: ({ column }) => <SortableHeader column={column} label="Computer" />,
    meta: { className: "hidden lg:table-cell" },
  },
  {
    // Source EVTX file (Phase 5.7 — Multi-EVTX Investigation). Every event
    // carries `sourceFile` once loaded through evidenceStore.ts, even in a
    // single-file case (see lib/multiFile.ts), so this column always has a
    // value to show; hidden below `xl` alongside Provider/Computer/User as
    // the lowest-priority of the always-present columns, and via the same
    // horizontally-scrollable fallback none of that data is ever
    // unreachable, just deprioritized on narrow viewports.
    accessorKey: "sourceFile",
    header: ({ column }) => <SortableHeader column={column} label="Source" />,
    cell: ({ getValue }) => {
      const sourceFile = getValue<string | undefined>();
      return (
        <span className="block max-w-40 truncate text-xs text-muted-foreground" title={sourceFile}>
          {sourceFile ?? "—"}
        </span>
      );
    },
    meta: { className: "hidden xl:table-cell" },
  },
  {
    accessorKey: "user",
    header: ({ column }) => <SortableHeader column={column} label="User" />,
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue<string>()}</span>
    ),
    meta: { className: "hidden lg:table-cell" },
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ getValue }) => (
      <span className="block max-w-md truncate sm:max-w-lg" title={getValue<string>()}>
        {getValue<string>()}
      </span>
    ),
    enableSorting: false,
    meta: { className: "min-w-56" },
  },
];
