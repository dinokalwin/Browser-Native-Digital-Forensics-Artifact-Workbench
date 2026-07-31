import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  /**
   * Numbers are formatted with `.toLocaleString()` (thousands separators);
   * strings are rendered as-is. A `ReactNode` is accepted for the rare card
   * that needs richer headline markup than a single line of text (see
   * StatisticsCards.tsx's Date Range card) — it renders as-is, at the same
   * position every other card's value occupies, so one card having custom
   * content never breaks the grid's alignment.
   */
  value: ReactNode;
  icon: LucideIcon;
  description?: string;
  /** Tailwind classes for the icon badge background/text, e.g. severity colors. */
  accentClassName?: string;
}

/**
 * Reusable summary metric card for SOC-style dashboards.
 *
 * Layout contract (this is what makes every card in a grid row come out
 * the same height, with every value starting at the same Y position,
 * without a single hard-coded height anywhere):
 * - `Card` stretches to `h-full` — CSS Grid's default row `align-items:
 *   stretch` already makes every card in the same grid row equal height;
 *   this just lets each card actually fill that height instead of
 *   shrink-wrapping its own content.
 * - The header row (label + icon) is the same fixed height on every card
 *   (same font size, same `h-10 w-10` icon container), so the value slot
 *   directly below it always starts at the same offset from the top.
 * - The value slot is `flex-1`: it absorbs whatever extra vertical space
 *   grid-stretch adds to shorter cards, so a one-line value and a
 *   two-line value both start at the same top position, and the
 *   description (if any) still lands at a consistent spot beneath it.
 *
 * Purely presentational — callers compute `value`/`description` from
 * whatever event set is currently loaded.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  accentClassName = "bg-primary/10 text-primary",
}: StatCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-1.5 p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
              accentClassName,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <div className="flex-1 pt-1.5 text-3xl font-semibold leading-tight tracking-tight tabular-nums text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>

        {description && (
          <p className="text-xs text-muted-foreground" title={description}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
