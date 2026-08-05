import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Minimal, accessible Tabs primitive (Sprint 5.9.2 — needed for
 * `MitreFindingDrawer`'s new Overview/Affected Events/Recommendations/IOC
 * Findings/Raw Detection tabs). Every other `ui/*` primitive in this
 * project wraps a Radix package, but `@radix-ui/react-tabs` isn't one of
 * this project's dependencies and this sprint's own instructions don't
 * call for adding one — so this is a small, self-contained implementation
 * of the same `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` shape shadcn/ui
 * exposes, following the WAI-ARIA "Tabs" pattern directly (roving
 * `tabIndex`, `role="tablist"/"tab"/"tabpanel"`, `aria-selected`/
 * `aria-controls`, Left/Right/Home/End arrow-key navigation with automatic
 * activation) rather than approximating it with plain buttons.
 *
 * Controlled only (`value`/`onValueChange`), matching every other
 * filter/selection component in this codebase's "controlled, state lives
 * in the parent" convention (see `MitreFilterToolbar`, `FilterToolbar`).
 */

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idBase: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Tabs>`);
  }
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({ value, onValueChange, className, children }: TabsProps) {
  const idBase = React.useId();
  const contextValue = React.useMemo(
    () => ({ value, setValue: onValueChange, idBase }),
    [value, onValueChange, idBase],
  );
  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  "aria-label": string;
}

export function TabsList({ className, children, onKeyDown, ...props }: TabsListProps) {
  const { setValue } = useTabsContext("TabsList");
  const listRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;

    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1 + tabs.length) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex !== currentIndex && nextIndex >= 0) {
      event.preventDefault();
      const next = tabs[nextIndex];
      next?.focus();
      const nextValue = next?.dataset.tabValue;
      if (nextValue) setValue(nextValue);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex w-full items-center gap-1 overflow-x-auto rounded-md bg-muted/40 p-1",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const { value: activeValue, setValue, idBase } = useTabsContext("TabsTrigger");
  const selected = activeValue === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${idBase}-tab-${value}`}
      aria-controls={`${idBase}-panel-${value}`}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-tab-value={value}
      onClick={() => setValue(value)}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { value: activeValue, idBase } = useTabsContext("TabsContent");
  if (activeValue !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      tabIndex={0}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
