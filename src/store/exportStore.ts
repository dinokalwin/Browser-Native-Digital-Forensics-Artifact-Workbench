import * as React from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { clearExportHistory, loadExportHistory, recordExport } from "@/lib/export/history";
import type { ExportFormat, ExportHistoryEntry } from "@/lib/export/types";

/**
 * Reactive layer over `lib/export/history.ts` (Phase 5.11) — same role and
 * shape as `store/caseStore.ts`: `localStorage` is the real source of
 * truth, this store is an in-memory mirror `ExportHistory.tsx` subscribes
 * to. Hydrates once, lazily, on first use via `useHydrateExportHistory`,
 * the same "load on first use, not up front" precedent
 * `useHydrateCaseStore` already established.
 */

interface ExportHistoryState {
  entries: ExportHistoryEntry[];
  hydrated: boolean;

  hydrate: () => void;
  record: (filename: string, format: ExportFormat, status: "success" | "failed") => void;
  clear: () => void;
}

export const useExportHistoryStore = create<ExportHistoryState>()(
  devtools(
    (set, get) => ({
      entries: [],
      hydrated: false,

      hydrate: () => {
        if (get().hydrated) return;
        set({ entries: loadExportHistory(), hydrated: true }, false, "exportHistory/hydrate");
      },

      record: (filename, format, status) => {
        const entry = recordExport(filename, format, status);
        set((s) => ({ entries: [entry, ...s.entries].slice(0, 10) }), false, "exportHistory/record");
      },

      clear: () => {
        clearExportHistory();
        set({ entries: [] }, false, "exportHistory/clear");
      },
    }),
    { name: "export-history-store" },
  ),
);

export function useHydrateExportHistory(): void {
  const hydrate = useExportHistoryStore((s) => s.hydrate);
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);
}
