import { formatCount } from "@/lib/analytics/charts";

/**
 * Phase 5.8 — UI/UX refinement only. Shape of one entry recharts hands to a
 * custom tooltip `content` element via prop injection — a deliberately
 * narrow, hand-typed subset of recharts' own (much larger, `any`-heavy)
 * `Payload` type, covering exactly the fields this component reads. Kept
 * local rather than importing recharts' generic `Payload<TValue, TName>`
 * type so this component's props stay simple and don't drag recharts'
 * value/name generics through every call site.
 */
export interface ChartTooltipEntry {
  value?: number | string | Array<number | string>;
  name?: string | number;
  color?: string;
  dataKey?: string | number;
  /** The original datum for this point/segment (recharts' well-established
   * "payload.payload" convention) — e.g. this app's `ChartDatum`. */
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  /** Injected by recharts' <Tooltip content={<ChartTooltip />} /> at render
   * time — see each chart's usage. */
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  /** Prepended to the label line, e.g. "Event " + "4624" (EventIdChart). */
  labelPrefix?: string;
  /**
   * Resolves the colored indicator dot for a payload entry. Falls back to
   * `entry.color` (recharts' own derived series color) when omitted, which
   * is correct for a single-color series (the Events Over Time line) but
   * NOT for per-segment `<Cell fill={...}>`-colored bars/pies — recharts
   * derives `color` from the parent `<Bar>`/`<Pie>` element's own fill,
   * not each Cell — so every multi-color chart passes this explicitly,
   * using the exact same color lookup it uses to paint its Cells.
   */
  colorFor?: (entry: ChartTooltipEntry, index: number) => string | undefined;
}

/**
 * Reusable dark-themed tooltip (Phase 5.8 — UI/UX refinement only) for
 * every analytics chart, replacing recharts' default light/unthemed
 * tooltip box. Purely presentational: renders whatever `payload` recharts
 * hands it via this app's existing popover tokens (the same
 * `bg-popover`/`text-popover-foreground`/`border-border` surface used by
 * dropdown-menu.tsx and other floating UI elsewhere in the app), so it
 * matches the dashboard instead of recharts' hardcoded white/black
 * defaults. No calculation happens here — every number shown is already
 * computed upstream by `lib/analytics/*`.
 */
export function ChartTooltip({ active, payload, label, labelPrefix, colorFor }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="min-w-[9rem] max-w-[16rem] rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      {label !== undefined && label !== "" && (
        <p className="mb-1.5 truncate text-[11px] font-medium text-muted-foreground">
          {labelPrefix}
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => {
          const color = colorFor?.(entry, index) ?? entry.color ?? "hsl(var(--primary))";
          const value = Array.isArray(entry.value) ? entry.value.join(", ") : entry.value;
          return (
            <div key={`${entry.dataKey ?? entry.name ?? index}`} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {entry.name !== undefined && (
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {entry.name}
                </span>
              )}
              <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                {typeof value === "number" ? formatCount(value) : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
