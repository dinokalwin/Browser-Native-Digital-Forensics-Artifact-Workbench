import { TableRow, TableCell } from "@/components/ui/table";

interface EvidenceTableSkeletonProps {
  columnCount: number;
  rowCount: number;
}

/**
 * Loading placeholder rows shown while events are being fetched/parsed.
 * Not currently wired to real backend state (Phase 4 is mock-data only)
 * but built to be driven by `evidenceStore.status` once that lands.
 */
export function EvidenceTableSkeleton({ columnCount, rowCount }: EvidenceTableSkeletonProps) {
  return (
    <>
      <TableRow className="sr-only">
        <TableCell colSpan={columnCount} role="status">
          Loading events…
        </TableCell>
      </TableRow>
      {Array.from({ length: Math.min(rowCount, 10) }).map((_, rowIndex) => (
        <TableRow key={rowIndex} aria-hidden="true">
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <div className="h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
