import * as React from "react";
import { SearchX } from "lucide-react";

import type { EvtxEvent } from "@/types/evidence";
import { useEvidenceStore } from "@/store/evidenceStore";
import { useUIStore } from "@/store/uiStore";
import { useNotesStore, useEnsureCaseNotesLoaded } from "@/store/notesStore";
import { useBookmarkMap, useEnsureCaseBookmarksLoaded } from "@/store/bookmarksStore";
import {
  DEFAULT_TIMELINE_FILTERS,
  filterTimelineEvents,
  groupEventsByDay,
  calculateTimelineStatistics,
  hasActiveTimelineFilters,
  getUniqueProviders,
  type TimelineFilters,
} from "@/lib/timeline";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TimelineStatistics } from "@/components/timeline/TimelineStatistics";
import { TimelineToolbar } from "@/components/timeline/TimelineToolbar";
import { TimelineDaySection } from "@/components/timeline/TimelineDaySection";
import { EventDetailsDrawer } from "@/components/evidence/EventDetailsDrawer";

// Stable empty-object references so the `useNotesStore`/`useBookmarksStore`
// selectors below never manufacture a fresh `{}` on every render when a
// case has no data yet — same reasoning as bookmarksStore.ts's own
// internal `EMPTY_MAP` constant.
const EMPTY_RECORD: Readonly<Record<string, unknown>> = {};

interface EventTimelineProps {
  events: EvtxEvent[];
}

/**
 * Professional investigation timeline (Sprint 4.3) — orchestrates the
 * toolbar, statistics, and grouped/collapsible day sections, all backed by
 * pure logic in lib/timeline.ts. Clicking an entry opens the *existing*
 * EventDetailsDrawer (also used by DashboardPage) rather than a
 * timeline-local detail view, so there is exactly one place in the app
 * that renders full event details.
 *
 * Reads `notesStore`/`bookmarksStore` directly via their already-exported
 * hooks (`useNotesStore`, `useBookmarkMap`, `useEnsureCase*Loaded`) rather
 * than through any new export — this sprint must not modify the Notes or
 * Bookmark systems themselves, only consume their existing public API,
 * the same way NoteIndicator/BookmarkIndicator already do inside
 * EvidenceTable's columns.
 */
export function EventTimeline({ events }: EventTimelineProps) {
  const caseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);
  const selectEvent = useUIStore((s) => s.selectEvent);

  useEnsureCaseNotesLoaded(caseId);
  useEnsureCaseBookmarksLoaded(caseId);
  const noteMap = useNotesStore((s) => (caseId ? (s.eventNotes[caseId] ?? EMPTY_RECORD) : EMPTY_RECORD));
  const bookmarkMap = useBookmarkMap(caseId);

  const [filters, setFilters] = React.useState<TimelineFilters>(DEFAULT_TIMELINE_FILTERS);
  const providers = React.useMemo(() => getUniqueProviders(events), [events]);

  // Timeline Statistics (Sprint 4.3) are deliberately case-wide — computed
  // from the full `events` prop, not the toolbar-filtered subset — see
  // lib/timeline.ts's calculateTimelineStatistics doc comment for why,
  // mirroring how the Dashboard's own Statistics Cards stay case-wide too.
  const statistics = React.useMemo(
    () => calculateTimelineStatistics(events, bookmarkMap, noteMap),
    [events, bookmarkMap, noteMap],
  );

  const filteredEvents = React.useMemo(
    () => filterTimelineEvents(events, filters, bookmarkMap, noteMap),
    [events, filters, bookmarkMap, noteMap],
  );
  const dayGroups = React.useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents]);

  // Event Details Inspector — local React state, same pattern as
  // DashboardPage.tsx (deliberately not lifted into Zustand). Still also
  // writes to `uiStore.selectedEvent` on click for cross-panel
  // consistency with the Evidence Table, matching that page's existing
  // dual-write behavior — but this component's own row-highlight styling
  // reads the local state below, not the store, since the store isn't
  // reset when the drawer closes.
  const [selectedEvent, setSelectedEvent] = React.useState<EvtxEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const handleSelectEvent = React.useCallback(
    (event: EvtxEvent) => {
      selectEvent(event);
      setSelectedEvent(event);
      setIsDrawerOpen(true);
    },
    [selectEvent],
  );
  const handleDrawerClose = React.useCallback(() => setIsDrawerOpen(false), []);

  return (
    <>
      <TimelineStatistics statistics={statistics} />

      <Card>
        <CardContent className="flex flex-col gap-6 p-6">
          <TimelineToolbar
            filters={filters}
            onFiltersChange={setFilters}
            hasActiveFilters={hasActiveTimelineFilters(filters)}
            providers={providers}
          />

          <p className="text-sm text-muted-foreground">
            Showing {filteredEvents.length.toLocaleString()} of {events.length.toLocaleString()} Events
          </p>

          <ScrollArea className="h-[calc(100vh-32rem)] min-h-80 rounded-lg border border-border">
            <div className="p-4 sm:p-6">
              {dayGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <SearchX className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="font-medium text-foreground">No matching events</p>
                  <p className="max-w-xs text-center text-sm text-muted-foreground">
                    Try adjusting your search or clearing the active filters.
                  </p>
                </div>
              ) : (
                dayGroups.map((group, index) => (
                  <TimelineDaySection
                    key={group.key}
                    label={group.label}
                    events={group.events}
                    defaultExpanded={index === 0}
                    selectedEventId={selectedEvent?.id}
                    onSelectEvent={handleSelectEvent}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <EventDetailsDrawer
        selectedEvent={selectedEvent}
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        caseId={caseId}
      />
    </>
  );
}
