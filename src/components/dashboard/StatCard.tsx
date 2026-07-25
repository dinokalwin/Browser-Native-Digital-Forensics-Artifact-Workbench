import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  description?: string;
  /** Tailwind classes for the icon badge background/text, e.g. severity colors. */
  accentClassName?: string;
}

/**
 * Reusable summary metric card for SOC-style dashboards. Purely
 * presentational — callers compute `value`/`description` from whatever
 * event set is currently loaded (mock or, eventually, real).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  accentClassName = "bg-primary/10 text-primary",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {value.toLocaleString()}
          </p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            accentClassName,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
