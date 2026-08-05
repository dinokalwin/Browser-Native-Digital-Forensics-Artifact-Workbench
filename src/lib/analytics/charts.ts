/**
 * Analytics Dashboard — chart presentation config (Phase 5.6).
 *
 * Pure color/formatting helpers shared by the chart components — no React,
 * no recharts import (recharts is only ever imported inside
 * `components/analytics/*.tsx`, so this file stays trivially cheap to
 * import from anywhere, including outside the lazy-loaded chart bundle).
 *
 * Colors reference this app's existing CSS custom properties (`hsl(var(--x))`,
 * see src/index.css / tailwind.config.ts's `severity.*`/`primary` tokens)
 * rather than hardcoded hex values, so charts automatically match the
 * current light/dark theme instead of needing their own theme detection.
 */
import type { DetectionFinding } from "@/lib/detection/types";
import type { EventLevel } from "@/types/evidence";

/** Event severity levels — reuses this app's existing severity tokens so a
 * chart's "Critical" matches the same red used everywhere else (LevelBadge,
 * the PDF report, RiskScoreCard). `Verbose` and `Information` don't have a
 * dedicated severity token; they fall back to muted/primary respectively. */
export const LEVEL_COLOR: Record<EventLevel, string> = {
  Critical: "hsl(var(--severity-critical))",
  Error: "hsl(var(--severity-critical))",
  Warning: "hsl(var(--severity-warning))",
  Information: "hsl(var(--primary))",
  Verbose: "hsl(var(--muted-foreground))",
};

export const SEVERITY_COLOR: Record<DetectionFinding["severity"], string> = {
  critical: "hsl(var(--severity-critical))",
  warning: "hsl(var(--severity-warning))",
  informational: "hsl(var(--primary))",
};

/** Small qualitative palette for series with no existing semantic color
 * (providers, computers, MITRE tactics) — cycled by index. Distinct hues
 * chosen to stay legible in both light and dark mode without needing a
 * separate dark-mode palette. */
export const CATEGORICAL_PALETTE: string[] = [
  "hsl(217 91% 60%)", // blue
  "hsl(262 83% 66%)", // violet
  "hsl(199 89% 48%)", // sky
  "hsl(142 71% 45%)", // green
  "hsl(38 92% 50%)", // amber
  "hsl(340 82% 59%)", // pink
  "hsl(280 65% 60%)", // purple
  "hsl(173 80% 40%)", // teal
  "hsl(24 95% 53%)", // orange
  "hsl(0 72% 51%)", // red
];

export function categoricalColor(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

/**
 * Phase 5.8 — UI/UX refinement only. Shared presentational style values for
 * recharts primitives (axis ticks, grid lines, cursor highlight), so every
 * chart references the same theme tokens instead of recharts' unthemed
 * defaults (black-ish tick text, solid gray grid). Plain style objects, no
 * React/recharts import — this file's existing "pure color/formatting
 * helpers" contract (see file header) is unchanged; nothing here computes
 * or aggregates data.
 */
export const AXIS_TICK_STYLE = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;

export const AXIS_LINE_STYLE = { stroke: "hsl(var(--border))" } as const;

export const GRID_STROKE = "hsl(var(--border))";

/** Softer than a solid grid line — used as the `<CartesianGrid stroke>` so
 * gridlines read as a subtle guide rather than competing with the data. */
export const GRID_STROKE_OPACITY = 0.5;

/** Muted highlight painted behind the hovered bar/column (recharts'
 * `<Tooltip cursor>`), replacing the library's default flat gray. */
export const CURSOR_FILL = "hsl(var(--muted) / 0.35)";

/** Compact integer formatter for axis ticks/tooltips (e.g. "12,345"). */
export function formatCount(value: number): string {
  return value.toLocaleString();
}

/** Truncates a long category label (provider names in particular can be
 * long) for axis display, while the full value stays available in the
 * tooltip/accessible label. */
export function truncateLabel(label: string, maxLength = 24): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}
