import * as React from "react";
import { motion } from "framer-motion";
import { Grid3x3 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CoverageMatrixColumn, HeatmapTier } from "@/lib/mitre/statistics";
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreHeatmapFilters } from "@/lib/mitre/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MitreHeatmapFilterBar } from "@/components/mitre/MitreHeatmapFilterBar";
import { MitreHeatmapLegend } from "@/components/mitre/MitreHeatmapLegend";
import { MitreMatrixExportControls } from "@/components/mitre/MitreMatrixExportControls";

interface MitreCoverageMatrixProps {
  columns: CoverageMatrixColumn[];
  /** The currently selected technique ID (`filters.technique` from
   * `MitreAttackPage`), or `null` when nothing is selected. Drives the
   * glow/ring highlight on that one cell. */
  selectedTechniqueId?: string | null;
  /** IDs of techniques that pass the page's current cross-filters, or
   * `null` when no filter is active (in which case nothing is dimmed).
   * Only ever narrows *observed* cells — unobserved cells have no "match"
   * concept of their own and stay at their normal muted styling. */
  filteredTechniqueIds?: ReadonlySet<string> | null;
  /** Clicking an *observed* cell toggles it into/out of `filters.technique`
   * (see `MitreAttackPage.tsx#handleToggleTechnique`). Unobserved cells
   * have nothing to select, so they never call this. */
  onToggleTechnique?: (id: string) => void;
  /** Sprint 5.9.3, Step 5 — controlled Heatmap Filters state (distinct
   * from the page's `MitreFilters` cross-filter — see
   * `MitreHeatmapFilters`'s doc comment). */
  heatmapFilters: MitreHeatmapFilters;
  onHeatmapFiltersChange: (filters: MitreHeatmapFilters) => void;
  /** Sprint 5.9.3, Step 9 — Export. Handed up to `MitreAttackPage` rather
   * than implemented here, since the export helpers
   * (`lib/mitre/export.ts`, `services/mitre/matrixPng.ts`) need the
   * *unfiltered* `columns` the page already has in hand (see that
   * component's own doc comment on why an export includes every known
   * technique, not just what Heatmap Filters currently show on screen). */
  onExportCsv: () => void;
  onExportPng: () => void;
  isExportingPng?: boolean;
}

const SEVERITY_VARIANT: Record<DetectionFinding["severity"], NonNullable<BadgeProps["variant"]>> = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
};

/** CSS custom property backing each heat tier — resolved at render time via
 * inline `style`, not a Tailwind class, since the *intensity* half of the
 * color needs a continuously-variable alpha Tailwind's fixed opacity
 * utilities can't express. Kept in exact sync with
 * `services/mitre/matrixPng.ts#resolvePalette`'s variable choices so the
 * on-screen heatmap and the exported PNG always agree. */
const HEAT_TIER_VARIABLE: Record<HeatmapTier, string> = {
  none: "--muted",
  informational: "--primary",
  warning: "--severity-warning",
  critical: "--severity-critical",
};

/** Same floor-plus-scale formula as `matrixPng.ts#heatColorFor` — an
 * observed cell is never fully transparent (0.35 floor) so a single-
 * finding technique still reads as clearly "present", and intensity only
 * controls how much hotter than that floor it gets. */
function heatCellStyle(tier: HeatmapTier, intensity: number): React.CSSProperties {
  const variable = HEAT_TIER_VARIABLE[tier];
  const alpha = tier === "none" ? 0.5 : 0.35 + Math.min(1, Math.max(0, intensity)) * 0.65;
  return {
    backgroundColor: `hsl(var(${variable}) / ${alpha})`,
    color: tier === "none" ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
  };
}

function truncateText(text: string, maxLength = 90): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

interface GridPosition {
  row: number;
  col: number;
}

/**
 * Coverage Matrix (Sprint 5.9.1) — every known MITRE technique
 * (`lib/mitre/mapping.ts`), grouped under its tactic column. Sprint 5.9.2
 * made observed cells clickable (technique cross-filter selection).
 *
 * Sprint 5.9.3 — "MITRE ATT&CK Navigator & Heatmap" — is the biggest
 * change this component has had:
 *
 * 1. **Heatmap coloring**: each cell's background is now driven by
 *    `cell.heatTier`/`cell.heatIntensity` (from `buildCoverageMatrix`) —
 *    muted/blue/amber/red for none/informational/warning/critical, with
 *    opacity scaling by finding count. This replaces Sprint 5.9.1's flat
 *    green/muted badge coloring entirely (severity, not just "observed or
 *    not", is now the primary visual signal — the ticket's explicit ask).
 * 2. **Risk Score Overlay**: each column header now shows finding count /
 *    highest severity / a 0-100 risk score badge.
 * 3. **Real ARIA grid + keyboard navigation**: Sprint 5.9.1/5.9.2
 *    deliberately avoided `role="grid"/"row"/"gridcell"` because this
 *    layout didn't implement the interactive-widget contract those roles
 *    promise (see this file's own prior doc comments, and
 *    `eslint-plugin-jsx-a11y`'s `no-noninteractive-element-to-interactive-
 *    role` rule) — this sprint explicitly requires "ARIA grid" +
 *    "Arrow-key movement between cells", so it now *does* implement that
 *    contract for real: cells render in true row-major DOM order (`role="
 *    row"` wrappers use `display: contents` so they don't affect the
 *    visual CSS Grid layout, while still being real DOM nodes assistive
 *    tech can traverse), a single roving `tabIndex` cell at a time, and
 *    Arrow/Home/End navigation that skips the ragged gaps where a tactic
 *    has fewer known techniques than the tallest column. This is the
 *    opposite conclusion from 5.9.1/5.9.2 for the same rule — appropriate
 *    because this sprint's cells now genuinely support the behavior the
 *    roles promise, rather than being a static, non-navigable layout
 *    wearing an interactive role as decoration.
 *
 * Column headers stay outside the keyboard-navigable grid (static labels,
 * not `tabIndex`-managed) — only the technique cells themselves are arrow-
 * key targets, which is the part of "Arrow-key movement between cells"
 * that's actually valuable to a keyboard user.
 */
export function MitreCoverageMatrix({
  columns,
  selectedTechniqueId = null,
  filteredTechniqueIds = null,
  onToggleTechnique,
  heatmapFilters,
  onHeatmapFiltersChange,
  onExportCsv,
  onExportPng,
  isExportingPng = false,
}: MitreCoverageMatrixProps) {
  const rows = columns.reduce((max, c) => Math.max(max, c.cells.length), 0);
  const cols = columns.length;

  const cellRefs = React.useRef<Array<Array<HTMLButtonElement | null>>>([]);

  // Lazy initializer — runs exactly once, on this component's first mount,
  // to seed the roving-tabindex grid at the first *observed* cell rather
  // than always {0,0} (which is often a "no findings" gap in the very
  // first tactic column). Deliberately not re-derived on later renders
  // even as `columns` changes (e.g. from Heatmap Filters) — the clamp
  // logic just below keeps whatever the analyst has since focused/clicked
  // valid, rather than this effectively "resetting" their position every
  // time a filter toggles.
  const [focusedCell, setFocusedCell] = React.useState<GridPosition>(() => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (columns[col]?.cells[row]?.observed) return { row, col };
      }
    }
    return { row: 0, col: 0 };
  });

  // Clamp focus back into bounds whenever a filter shrinks the grid out
  // from under the currently-focused cell — the same render-time "adjust
  // state" pattern (react.dev/learn/you-might-not-need-an-effect) this
  // page's drawers already use for their own local state, rather than a
  // `useEffect` this repo's react-hooks/set-state-in-effect rule would
  // flag as a cascading-render risk.
  const clampedRow = rows === 0 ? 0 : Math.min(focusedCell.row, rows - 1);
  const clampedCol = cols === 0 ? 0 : Math.min(focusedCell.col, cols - 1);
  if ((clampedRow !== focusedCell.row || clampedCol !== focusedCell.col) && rows > 0 && cols > 0) {
    setFocusedCell({ row: clampedRow, col: clampedCol });
  }
  const activeFocus = { row: clampedRow, col: clampedCol };

  const setCellRef = (row: number, col: number, el: HTMLButtonElement | null) => {
    if (!cellRefs.current[row]) cellRefs.current[row] = [];
    cellRefs.current[row][col] = el;
  };

  const focusCell = (row: number, col: number) => {
    cellRefs.current[row]?.[col]?.focus();
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
    const cell = columns[col]?.cells[row];

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (cell?.observed) onToggleTechnique?.(cell.id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      for (let c = 0; c <= col; c++) {
        if (columns[c]?.cells[row]) {
          focusCell(row, c);
          break;
        }
      }
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      for (let c = cols - 1; c >= col; c--) {
        if (columns[c]?.cells[row]) {
          focusCell(row, c);
          break;
        }
      }
      return;
    }

    let dRow = 0;
    let dCol = 0;
    if (event.key === "ArrowRight") dCol = 1;
    else if (event.key === "ArrowLeft") dCol = -1;
    else if (event.key === "ArrowDown") dRow = 1;
    else if (event.key === "ArrowUp") dRow = -1;
    else return;

    event.preventDefault();
    const maxSteps = Math.max(rows, cols);
    for (let step = 1; step <= maxSteps; step++) {
      const nextRow = row + dRow * step;
      const nextCol = col + dCol * step;
      if (nextRow < 0 || nextRow >= rows || nextCol < 0 || nextCol >= cols) break;
      if (columns[nextCol]?.cells[nextRow]) {
        focusCell(nextRow, nextCol);
        break;
      }
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Grid3x3 className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold text-foreground">ATT&CK Navigator Heatmap</CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            Every technique this engine can detect, grouped by tactic — color and intensity encode severity and
            finding volume for techniques observed in this case.
          </CardDescription>
        </div>
        <MitreMatrixExportControls
          onExportCsv={onExportCsv}
          onExportPng={onExportPng}
          isExportingPng={isExportingPng}
          disabled={columns.length === 0}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <MitreHeatmapFilterBar filters={heatmapFilters} onFiltersChange={onHeatmapFiltersChange} />

        {cols === 0 ? (
          <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No tactics match the current Heatmap Filters.
          </p>
        ) : (
          <div
            role="grid"
            aria-label="MITRE ATT&CK technique heatmap"
            aria-rowcount={rows + 1}
            aria-colcount={cols}
            className="overflow-x-auto pb-1"
          >
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(104px, 1fr))`,
                gridTemplateRows: `auto repeat(${Math.max(rows, 1)}, auto)`,
              }}
            >
              {/* `display: contents` keeps this a real `role="row"` DOM
                  node (so a screen reader's grid navigation sees genuine
                  rows) without it participating in the CSS Grid box model
                  itself — each header cell below places itself via its own
                  `gridColumn`/`gridRow`, matching every data row's same
                  technique. */}
              <div role="row" style={{ display: "contents" }}>
                {columns.map((column, colIndex) => (
                  <div
                    key={column.tactic}
                    role="columnheader"
                    style={{ gridColumn: colIndex + 1, gridRow: 1 }}
                    className="flex flex-col gap-1 rounded-md border border-border bg-muted/20 p-2"
                  >
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" title={column.tactic}>
                      {column.tactic}
                    </p>
                    {column.cells.length === 0 ? (
                      <p className="text-[9px] text-muted-foreground/70">No mapped techniques</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">
                          {column.findingCount.toLocaleString()}
                        </Badge>
                        <Badge
                          variant={column.highestSeverity ? SEVERITY_VARIANT[column.highestSeverity] : "outline"}
                          className="px-1 py-0 text-[9px]"
                        >
                          Risk {column.riskScore}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} role="row" style={{ display: "contents" }}>
                  {columns.map((column, colIndex) => {
                    const cell = column.cells[rowIndex];
                    if (!cell) {
                      return (
                        <div
                          key={colIndex}
                          aria-hidden="true"
                          style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 2 }}
                        />
                      );
                    }

                    const selected = cell.observed && cell.id === selectedTechniqueId;
                    const dimmed =
                      cell.observed && filteredTechniqueIds !== null && filteredTechniqueIds !== undefined
                        ? !filteredTechniqueIds.has(cell.id)
                        : false;
                    const isFocusTarget = activeFocus.row === rowIndex && activeFocus.col === colIndex;

                    return (
                      <Tooltip key={cell.id}>
                        <TooltipTrigger asChild>
                          <motion.button
                            ref={(el) => setCellRef(rowIndex, colIndex, el)}
                            type="button"
                            role="gridcell"
                            aria-selected={cell.observed ? selected : undefined}
                            tabIndex={isFocusTarget ? 0 : -1}
                            onFocus={() => setFocusedCell({ row: rowIndex, col: colIndex })}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIndex, colIndex)}
                            onClick={cell.observed ? () => onToggleTechnique?.(cell.id) : undefined}
                            style={{
                              gridColumn: colIndex + 1,
                              gridRow: rowIndex + 2,
                              ...heatCellStyle(cell.heatTier, cell.heatIntensity),
                            }}
                            animate={{ scale: selected ? 1.08 : 1, opacity: dimmed ? 0.35 : 1 }}
                            whileHover={cell.observed ? { scale: selected ? 1.12 : 1.05 } : undefined}
                            whileTap={cell.observed ? { scale: 0.96 } : undefined}
                            transition={{ type: "spring", stiffness: 400, damping: 24 }}
                            className={cn(
                              "rounded-md border px-1.5 py-1 text-left font-mono text-[10px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                              cell.observed ? "cursor-pointer border-transparent" : "cursor-default border-border/60",
                              selected && "ring-2 ring-primary shadow-[0_0_12px_hsl(var(--primary)/0.55)]",
                            )}
                            aria-label={`${cell.id} — ${cell.name} — ${column.tactic} — ${
                              cell.observed
                                ? `${cell.highestSeverity ?? "unknown"} severity, ${cell.findingCount} finding${cell.findingCount === 1 ? "" : "s"}${selected ? " — selected" : ""}`
                                : "not observed"
                            }`}
                          >
                            {cell.id}
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[18rem]">
                          <p className="font-mono font-semibold">{cell.id}</p>
                          <p>{cell.name}</p>
                          <p className="text-muted-foreground">{column.tactic}</p>
                          {cell.observed ? (
                            <>
                              <p className="mt-0.5">
                                <span className="capitalize">{cell.highestSeverity}</span> ·{" "}
                                {cell.findingCount.toLocaleString()} finding{cell.findingCount === 1 ? "" : "s"}
                              </p>
                              {cell.recommendation && (
                                <p className="mt-1 text-muted-foreground">
                                  {truncateText(cell.recommendation)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="mt-0.5 text-muted-foreground">Not observed in this case</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <MitreHeatmapLegend />
      </CardContent>
    </Card>
  );
}
