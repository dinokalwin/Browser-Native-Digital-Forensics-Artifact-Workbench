import type { LucideIcon } from "lucide-react";
import { AlertTriangle, FileSearch, FilterX, Loader2, SearchX, UploadCloud } from "lucide-react";

export type SearchEmptyStateVariant =
  | "no-investigation"
  | "no-query"
  | "no-results"
  | "no-filter-match"
  | "building-index"
  | "error";

interface SearchEmptyStateProps {
  variant: SearchEmptyStateVariant;
  /** Only used by the `"error"` variant — the caught error's message. */
  errorMessage?: string;
}

const VARIANT_CONTENT: Record<SearchEmptyStateVariant, { icon: LucideIcon; title: string; description: string }> = {
  "no-investigation": {
    icon: UploadCloud,
    title: "No investigation loaded",
    description: "Upload a case file from the landing page to search its events, findings, and intelligence.",
  },
  "no-query": {
    icon: FileSearch,
    title: "Start typing to search this investigation",
    description: "Search events, IOC findings, MITRE techniques, notes, bookmarks, and case metadata all at once.",
  },
  "no-results": {
    icon: SearchX,
    title: "No matching evidence found",
    description: "Try a broader search term, or check for typos in an Event ID or MITRE technique.",
  },
  "no-filter-match": {
    icon: FilterX,
    title: "No matching evidence found",
    description: "Try removing a filter or using a broader search.",
  },
  "building-index": {
    icon: Loader2,
    title: "Preparing the search index…",
    description: "This only happens once per investigation — results will appear as soon as it's ready.",
  },
  error: {
    icon: AlertTriangle,
    title: "Search couldn't complete",
    description: "An unexpected error occurred while searching. Try a different query.",
  },
};

/**
 * Every non-results state the search UI can be in (ticket "14. EMPTY
 * STATES"). A single component with a `variant` switch, rather than six
 * near-identical components, since every variant shares the exact same
 * icon-circle + title + description layout `EmptyState.tsx` already
 * established for the rest of this app — this is that same shape, sized
 * for a command-palette result area instead of a full page.
 */
export function SearchEmptyState({ variant, errorMessage }: SearchEmptyStateProps) {
  const content = VARIANT_CONTENT[variant];
  const Icon = content.icon;

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className={variant === "building-index" ? "h-5 w-5 animate-spin" : "h-5 w-5"} aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-foreground">{content.title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {variant === "error" && errorMessage ? errorMessage : content.description}
      </p>
    </div>
  );
}
