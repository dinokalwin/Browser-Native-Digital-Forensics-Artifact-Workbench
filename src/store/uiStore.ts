import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { EvtxEvent } from "@/types/evidence";

/**
 * Ephemeral, non-persisted UI state for the app shell and cross-panel
 * interactions:
 *  - `sidebarCollapsed` — desktop sidebar rail (icon-only) vs full width.
 *  - `mobileNavOpen` — visibility of the Sheet-based nav drawer on small
 *    viewports. Kept separate from `sidebarCollapsed` because the two
 *    controls are mutually exclusive at different breakpoints and
 *    conflating them made the desktop/mobile toggle logic ambiguous.
 *  - `selectedEvent` — drives cross-linking between the table, timeline,
 *    and a future detail panel.
 */

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  selectedEvent: EvtxEvent | null;

  toggleSidebarCollapsed: () => void;
  setMobileNavOpen: (open: boolean) => void;
  selectEvent: (event: EvtxEvent | null) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      selectedEvent: null,

      toggleSidebarCollapsed: () =>
        set(
          (state) => ({ sidebarCollapsed: !state.sidebarCollapsed }),
          false,
          "ui/toggleSidebarCollapsed",
        ),
      setMobileNavOpen: (mobileNavOpen) =>
        set({ mobileNavOpen }, false, "ui/setMobileNavOpen"),
      selectEvent: (selectedEvent) =>
        set({ selectedEvent }, false, "ui/selectEvent"),
    }),
    { name: "ui-store" },
  ),
);
