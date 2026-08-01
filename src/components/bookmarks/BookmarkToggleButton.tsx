import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  useIsBookmarked,
  useEnsureCaseBookmarksLoaded,
  useBookmarksStore,
} from "@/store/bookmarksStore";

export interface BookmarkToggleButtonProps {
  /** Uploaded file name — the key bookmarks are namespaced under (see lib/bookmarks.ts). */
  caseId: string | null;
  /** EvtxEvent.id of the event currently shown in the drawer. */
  eventId: string;
  className?: string;
}

/**
 * "☆ Bookmark Event" / "★ Remove Bookmark" toggle for the Event Details
 * Drawer (Sprint 4.2). Self-contained, same pattern as EventNoteSection
 * (Sprint 4.1): reads/writes `bookmarksStore` directly rather than being
 * threaded through the drawer's own props, so the drawer itself stays a
 * thin integration point.
 */
export function BookmarkToggleButton({ caseId, eventId, className }: BookmarkToggleButtonProps) {
  useEnsureCaseBookmarksLoaded(caseId);

  const bookmarked = useIsBookmarked(caseId, eventId);
  const toggleBookmark = useBookmarksStore((s) => s.toggleBookmark);

  if (!caseId) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      aria-pressed={bookmarked}
      onClick={() => toggleBookmark(caseId, eventId)}
    >
      <Star
        className={cn("h-3.5 w-3.5", bookmarked ? "fill-primary text-primary" : "text-muted-foreground")}
        aria-hidden="true"
      />
      {bookmarked ? "Remove Bookmark" : "Bookmark Event"}
    </Button>
  );
}
