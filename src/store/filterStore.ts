import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { SortingState, PaginationState } from "@tanstack/react-table";
import type { EvidenceFilters } from "@/types/evidence";

/**
 * View state for the evidence table: search query, column filters,
 * sorting, and pagination. Deliberately separate from `evidenceStore` —
 * typing in the search box or flipping a page should never re-render
 * components that only depend on raw event data.
 */

interface FilterState {
  searchQuery: string;
  activeFilters: EvidenceFilters;
  sorting: SortingState;
  pagination: PaginationState;

  setSearchQuery: (query: string) => void;
  setFilter: <K extends keyof EvidenceFilters>(key: K, value: EvidenceFilters[K]) => void;
  clearFilters: () => void;
  setSorting: (sorting: SortingState) => void;
  setPagination: (pagination: PaginationState) => void;
}

const defaultFilters: EvidenceFilters = {
  eventId: null,
  provider: null,
  level: null,
  channel: null,
  dateRange: { start: null, end: null },
};

const defaultPagination: PaginationState = {
  pageIndex: 0,
  pageSize: 25,
};

export const useFilterStore = create<FilterState>()(
  devtools(
    (set) => ({
      searchQuery: "",
      activeFilters: defaultFilters,
      sorting: [],
      pagination: defaultPagination,

      setSearchQuery: (searchQuery) =>
        set({ searchQuery, pagination: defaultPagination }, false, "filter/setSearchQuery"),

      setFilter: (key, value) =>
        set(
          (state) => ({
            activeFilters: { ...state.activeFilters, [key]: value },
            pagination: defaultPagination,
          }),
          false,
          "filter/setFilter",
        ),

      clearFilters: () =>
        set(
          {
            activeFilters: defaultFilters,
            searchQuery: "",
            pagination: defaultPagination,
          },
          false,
          "filter/clearFilters",
        ),

      setSorting: (sorting) => set({ sorting }, false, "filter/setSorting"),

      setPagination: (pagination) => set({ pagination }, false, "filter/setPagination"),
    }),
    { name: "filter-store" },
  ),
);
