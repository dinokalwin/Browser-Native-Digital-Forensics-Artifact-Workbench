import * as React from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Tailwind classes for the icon's badge background/text — same
   * "colored square behind the icon" convention `StatCard.accentClassName`
   * already established for the dashboard's stat cards, applied here so a
   * chart's icon reads the same way a stat card's does instead of sitting
   * as a bare glyph next to the title. */
  iconClassName?: string;
  /** Extra grid-span classes (e.g. "lg:col-span-2") for charts that should
   * be wider than the default single grid cell — see AnalyticsPanel.tsx. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared Card shell for every analytics chart (Phase 5.6, restyled in
 * Phase 5.8 for visual consistency with the rest of the dashboard — no
 * change to what any chart computes or renders inside it). Matches
 * `StatCard`'s layout contract: `h-full` + a fixed-height header region so
 * every card in a CSS Grid row comes out the same height regardless of
 * whether it has a description, and the icon gets the same rounded
 * colored-badge treatment `StatCard` uses instead of a bare icon glyph.
 */
export function ChartCard({ title, description, icon, iconClassName, className, children }: ChartCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col animate-in fade-in duration-300 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-3">
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              iconClassName ?? "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm font-semibold text-foreground">{title}</CardTitle>
          {description && <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        <div className="h-64 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}
