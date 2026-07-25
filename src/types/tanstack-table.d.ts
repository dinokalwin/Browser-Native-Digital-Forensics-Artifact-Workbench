import "@tanstack/react-table";

/**
 * Augments TanStack Table's ColumnMeta so `columnDef.meta.className` is
 * typed. Used by EvidenceTable to apply responsive visibility classes
 * (see columns.tsx) to both header and body cells for a given column.
 */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    className?: string;
  }
}
