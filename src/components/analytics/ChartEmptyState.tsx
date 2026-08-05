import { BarChart3 } from "lucide-react";

interface ChartEmptyStateProps {
  message?: string;
}

/**
 * Shared "nothing to plot" state (Phase 5.6's "graceful empty states"
 * requirement; restyled in Phase 5.8 to match the dashboard-wide
 * `EmptyState` component's visual language — a circular muted icon badge
 * rather than a bare glyph — so an empty chart reads consistently with
 * every other empty/placeholder surface in the app). Every chart component
 * renders this instead of an empty or broken recharts canvas when it has
 * no data (empty case, or a filter that happens to produce zero matching
 * findings for the threat/MITRE charts).
 */
export function ChartEmptyState({ message = "No data available for this case." }: ChartEmptyStateProps) {
  return (
    <div className="flex h-full animate-in fade-in flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border px-6 text-center duration-300">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="max-w-[16rem] text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
