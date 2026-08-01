import { Star } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { useBookmarkCount, useEnsureCaseBookmarksLoaded } from "@/store/bookmarksStore";

export interface BookmarkedEventsCardProps {
  /** Uploaded file name — the key bookmarks are namespaced under (see lib/bookmarks.ts). */
  caseId: string | null;
  /**
   * Clicking the card should take the investigator to a bookmarked-only
   * view of the evidence. There's no cross-page "bookmarked" deep link
   * today (the Evidence Viewer route has no filter UI of its own, and
   * wiring one up would mean touching either the filtering engine or
   * filterStore — both out of scope for this sprint), so this instead
   * "prepares the state for future navigation" per this sprint's own
   * spec: it enables the dashboard's own "Bookmarked Only" toggle and
   * scrolls the All Events card into view, which is the same page's own
   * evidence table already filtered to bookmarks — no navigation needed.
   */
  onView: () => void;
  className?: string;
}

/**
 * Dashboard-level "Bookmarked Events" card (Sprint 4.2). Reuses the
 * existing `StatCard` presentation component (now `onClick`-capable) for
 * visual consistency with the Investigation Statistics cards, but is
 * intentionally its own component and its own data source
 * (`bookmarksStore`, not `lib/statistics.ts`) — bookmark counts are not
 * part of "statistics calculations", which this sprint must not touch.
 */
export function BookmarkedEventsCard({ caseId, onView, className }: BookmarkedEventsCardProps) {
  useEnsureCaseBookmarksLoaded(caseId);
  const count = useBookmarkCount(caseId);

  return (
    <StatCard
      label="Bookmarked Events"
      value={count}
      icon={Star}
      description={count > 0 ? "Click to view bookmarked events" : "No events bookmarked yet"}
      accentClassName="bg-primary/10 text-primary"
      onClick={count > 0 ? onView : undefined}
      className={className}
    />
  );
}
