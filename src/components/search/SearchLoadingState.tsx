import { Loader2 } from "lucide-react";

interface SearchLoadingStateProps {
  /** Total event count in the currently loaded case — used only for the
   * "Searching N events…" copy (ticket "16. SEARCH PERFORMANCE UI"); the
   * search itself always runs against the pre-built index, never these
   * raw events, regardless of what this number says. */
  eventCount: number;
}

/**
 * Shown while `searchStore.ts#useSearchResults`'s debounce/rAF-deferred
 * search is in flight — for a small case this is only visible for a
 * moment (or not at all), but for a large one it's what keeps the palette
 * from looking frozen during the (still sub-frame, per the runtime
 * harness) scoring pass.
 */
export function SearchLoadingState({ eventCount }: SearchLoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        {eventCount > 0 ? `Searching ${eventCount.toLocaleString()} events…` : "Searching…"}
      </p>
    </div>
  );
}
