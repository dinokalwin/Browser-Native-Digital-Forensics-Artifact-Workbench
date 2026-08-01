import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Multiline counterpart to `Input` (src/components/ui/input.tsx) — didn't
 * exist in the project yet (only `dropdown-menu.tsx`-style primitives and
 * single-line `input.tsx`), added here for Investigator Notes (Sprint
 * 4.1). Mirrors `Input`'s exact visual treatment (border/background/
 * focus-ring/placeholder tokens) so it reads as the same design system
 * rather than a one-off. Not a new dependency — a local component in the
 * same style as every other file in this directory.
 */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
