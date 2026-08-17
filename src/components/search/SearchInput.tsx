import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoFocus?: boolean;
  /** Extra classes for the outer row wrapper — `SearchCommand.tsx` uses
   * this to reserve a little extra right-hand space so the clear button
   * doesn't sit under `DialogContent`'s own built-in top-right close (X)
   * button, without this component needing to know anything about being
   * inside a dialog. */
  className?: string;
  /** Which result row (if any) is currently keyboard-selected — wired to
   * `aria-activedescendant` so screen-reader/keyboard users always know
   * which row Enter would choose, even though DOM focus never actually
   * leaves this input. */
  activeDescendantId?: string;
  /** Whether the results list currently has anything in it — required
   * (not optional pass-through) so `role="combobox"`'s `aria-expanded` is
   * always a real, present attribute on the rendered input rather than one
   * that depends on whether a caller remembered to pass it (`jsx-a11y/
   * role-has-required-aria-props` checks the JSX literal here statically,
   * not what any particular caller happens to supply). */
  expanded?: boolean;
}

/**
 * The search box itself — controlled, presentational. Arrow/Enter/Escape
 * key handling is owned by `SearchCommand.tsx`/`SearchPage.tsx` (passed in
 * via `onKeyDown`) since which result is "active" and what Enter should do
 * is orchestration state this component has no business holding.
 *
 * `autoFocus` here is deliberate (unlike `RenameCaseDialog.tsx`'s Phase
 * 5.10 fix, which removed a redundant one): Radix `Dialog.Content`'s own
 * auto-focus lands on the dialog's outer container, not this input, and a
 * command palette is only useful if the investigator can start typing the
 * instant it opens — so this is the one legitimate use `jsx-a11y/no-
 * autofocus` still flags but this project accepts, matching the same
 * "Ctrl/Cmd+K opens search, ready to type" affordance every command
 * palette (VS Code, Linear, Slack) implements this way.
 */
export function SearchInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "Search events, IOCs, MITRE techniques, notes…",
  autoFocus = false,
  className,
  activeDescendantId,
  expanded = false,
}: SearchInputProps) {
  return (
    <div className={cn("relative flex items-center border-b border-border px-4", className)}>
      <Search className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        aria-controls="global-search-results"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-activedescendant={activeDescendantId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- see doc comment above
        autoFocus={autoFocus}
        className={cn(
          "h-12 w-full border-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-0",
        )}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
