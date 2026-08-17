import * as React from "react";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Bookmark, ShieldAlert, ShieldCheck, StickyNote, Table2, Folders } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/evidence/level-badge";
import type { SearchResult, SearchResultType } from "@/lib/search/types";
import { SEARCH_RESULT_TYPE_LABEL, SEARCH_SEVERITY_BADGE_VARIANT } from "@/lib/search/types";

const RESULT_TYPE_ICON: Record<SearchResultType, LucideIcon> = {
  event: Table2,
  ioc: ShieldAlert,
  mitre: ShieldCheck,
  note: StickyNote,
  bookmark: Bookmark,
  case: Folders,
};

interface SearchResultItemProps {
  result: SearchResult;
  /** The current search's free-text portion (`SearchResponse.freeText`) —
   * deliberately NOT the raw query, since a raw query still carrying
   * `key:value` operators (e.g. `"eventid:4624 powershell"`) would almost
   * never appear verbatim inside a result's title/message, whereas the
   * free-text remainder (`"powershell"`) actually does. */
  freeText: string;
  isActive: boolean;
  /** DOM id this row renders with — the palette wires this into
   * `aria-activedescendant` on the search input, so keyboard users always
   * know which row is selected even though focus never actually leaves the
   * input. */
  id: string;
  onSelect: (result: SearchResult) => void;
  onMouseEnter: () => void;
}

/**
 * Safely highlights every case-insensitive occurrence of `needle` inside
 * `text` by wrapping it in `<mark>` — built with `String.split` on a
 * capturing-group `RegExp` so the matched substrings survive as their own
 * array entries, never with `dangerouslySetInnerHTML` (ticket "13.
 * HIGHLIGHTING" explicitly forbids it). Special regex characters in
 * `needle` are escaped since it's raw user input, not a pattern.
 */
function highlightMatches(text: string, needle: string): React.ReactNode {
  const trimmed = needle.trim();
  if (trimmed.length === 0 || text.length === 0) return text;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length <= 1) return text;

  const needleLower = trimmed.toLowerCase();
  return parts.map((part, index) =>
    part.toLowerCase() === needleLower ? (
      <mark key={index} className="rounded-sm bg-primary/25 text-foreground">
        {part}
      </mark>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    ),
  );
}

/**
 * One row inside a `SearchResultGroup` (ticket "9. RESULT ITEM DISPLAY") —
 * icon + type badge, title, subtitle, a matched snippet of the
 * description/message, plus severity/level badges and a timestamp when the
 * result has them. Presentational only: it never resolves anything beyond
 * what `SearchResult` already carries, and never calls `search()`,
 * `buildSearchIndex()`, or any store action itself — selection and
 * navigation are both owned by the caller (`SearchCommand.tsx`/
 * `SearchResults.tsx`) via `onSelect`.
 */
function SearchResultItemImpl({ result, freeText, isActive, id, onSelect, onMouseEnter }: SearchResultItemProps) {
  const Icon = RESULT_TYPE_ICON[result.type];
  const timestamp = result.timestamp ? new Date(result.timestamp) : null;
  const hasValidTimestamp = timestamp !== null && !Number.isNaN(timestamp.getTime());

  return (
    <li role="presentation">
      <button
        id={id}
        type="button"
        role="option"
        aria-selected={isActive}
        onClick={() => onSelect(result)}
        onMouseEnter={onMouseEnter}
        className={cn(
          "flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive && "bg-primary/10",
        )}
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground">
              {SEARCH_RESULT_TYPE_LABEL[result.type]}
            </Badge>
            <span className="truncate text-sm font-medium text-foreground">
              {highlightMatches(result.title, freeText)}
            </span>
            {result.level && <LevelBadge level={result.level} />}
            {result.severity && (
              <Badge variant={SEARCH_SEVERITY_BADGE_VARIANT[result.severity]} className="shrink-0 text-[10px]">
                {result.severity}
              </Badge>
            )}
          </span>

          {result.subtitle && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {highlightMatches(result.subtitle, freeText)}
            </span>
          )}

          {result.description && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground/90">
              {highlightMatches(result.description, freeText)}
            </span>
          )}

          {hasValidTimestamp && (
            <time dateTime={result.timestamp} className="mt-1 block font-mono text-[10px] tabular-nums text-muted-foreground">
              {format(timestamp, "yyyy-MM-dd HH:mm:ss")}
            </time>
          )}
        </span>
      </button>
    </li>
  );
}

export const SearchResultItem = React.memo(SearchResultItemImpl);
