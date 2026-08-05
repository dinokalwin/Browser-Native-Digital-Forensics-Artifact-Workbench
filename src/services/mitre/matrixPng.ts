/**
 * MITRE ATT&CK Heatmap — PNG export (Sprint 5.9.3, Step 9).
 *
 * DOM/Canvas-touching, so it lives in `services/` rather than `lib/mitre/`
 * (mirrors `services/report/pdfGenerator.ts`'s split: pure data prep in
 * `lib/*`, browser-API-touching orchestration here) — `buildHeatmapCsvText`
 * in `lib/mitre/export.ts` is this same export feature's pure half.
 *
 * Deliberately draws the heatmap from `CoverageMatrixColumn[]` data using
 * the plain Canvas 2D API rather than rasterizing the live DOM (e.g. via
 * html2canvas): this project has no declared dependency on a DOM-to-image
 * library — `html2canvas` only exists in `node_modules` as jsPDF's own
 * internal, undeclared transitive dependency, and reaching into another
 * package's implementation detail would be fragile (liable to silently
 * break on a future jsPDF version bump) and untracked in package.json.
 * Drawing directly from data also sidesteps the tainted-canvas/CORS
 * failure modes DOM screenshotting is prone to, and keeps this export a
 * pure function of the same `columns` data every other part of this
 * feature already renders from — no re-scan of `iocFindings`.
 */
import type { CoverageMatrixColumn } from "@/lib/mitre/statistics";

const CELL_WIDTH = 108;
const CELL_HEIGHT = 30;
const CELL_GAP = 4;
const HEADER_HEIGHT = 56;
const LEGEND_HEIGHT = 40;
const PADDING = 24;

/** Reads a theme color straight off `:root`/`.dark` (whichever class is
 * currently applied to `<html>` — see `ThemeProvider`, unmodified by this
 * sprint) so the exported image matches whatever palette the analyst is
 * actually looking at, without this module needing to know which theme is
 * active. Falls back to a reasonable dark-theme default if the variable
 * isn't set for some reason (e.g. this ever runs before the stylesheet is
 * attached) rather than throwing. */
function resolveHslVar(variableName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return raw || fallback;
}

interface HeatmapPalette {
  background: string;
  border: string;
  text: string;
  mutedText: string;
  none: string;
  informational: string;
  warning: string;
  critical: string;
}

function resolvePalette(): HeatmapPalette {
  return {
    background: resolveHslVar("--background", "222 47% 5%"),
    border: resolveHslVar("--border", "217 33% 17%"),
    text: resolveHslVar("--foreground", "210 40% 96%"),
    mutedText: resolveHslVar("--muted-foreground", "215 20% 65%"),
    none: resolveHslVar("--muted", "217 33% 17%"),
    informational: resolveHslVar("--primary", "217 91% 60%"),
    warning: resolveHslVar("--severity-warning", "38 92% 50%"),
    critical: resolveHslVar("--severity-critical", "0 72% 51%"),
  };
}

function heatColorFor(
  palette: HeatmapPalette,
  tier: CoverageMatrixColumn["cells"][number]["heatTier"],
  intensity: number,
): string {
  if (tier === "none") return `hsl(${palette.none} / 0.6)`;
  const base = tier === "critical" ? palette.critical : tier === "warning" ? palette.warning : palette.informational;
  // Never fully transparent for an observed cell (floor of 0.35) — even a
  // single-finding technique should read as clearly "present" against the
  // background, with intensity only controlling how much *hotter* than
  // that floor it gets.
  const alpha = 0.35 + Math.min(1, Math.max(0, intensity)) * 0.65;
  return `hsl(${base} / ${alpha.toFixed(2)})`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/**
 * Draws the full heatmap (every column passed in — typically already
 * narrowed by `applyHeatmapFilters` to whatever the analyst currently has
 * visible, so the exported image matches the on-screen view) onto an
 * off-screen canvas and resolves a PNG `Blob`. Caller (see
 * `MitreMatrixExportControls.tsx`) hands that to the existing
 * `lib/download-blob.ts#downloadBlob` helper — this module only produces
 * the image, it never touches the DOM outside of creating its own
 * temporary `<canvas>` and reading theme CSS variables.
 */
export function exportHeatmapAsPngBlob(columns: readonly CoverageMatrixColumn[]): Promise<Blob> {
  const palette = resolvePalette();
  const rows = columns.reduce((max, c) => Math.max(max, c.cells.length), 0);

  const width = PADDING * 2 + columns.length * (CELL_WIDTH + CELL_GAP);
  const height = PADDING * 2 + HEADER_HEIGHT + rows * (CELL_HEIGHT + CELL_GAP) + LEGEND_HEIGHT;

  const canvas = document.createElement("canvas");
  // devicePixelRatio scaling so the exported PNG stays crisp on a HiDPI
  // display instead of looking upscaled/blurry.
  const scale = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas 2D context is unavailable in this browser."));
  }
  ctx.scale(scale, scale);

  ctx.fillStyle = `hsl(${palette.background})`;
  ctx.fillRect(0, 0, width, height);

  columns.forEach((column, colIndex) => {
    const x = PADDING + colIndex * (CELL_WIDTH + CELL_GAP);

    // Column header: tactic name + finding count / risk score badge line.
    ctx.fillStyle = `hsl(${palette.text})`;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(truncate(ctx, column.tactic, CELL_WIDTH), x, PADDING);

    ctx.fillStyle = `hsl(${palette.mutedText})`;
    ctx.font = "10px system-ui, sans-serif";
    const severityLabel = column.highestSeverity ? column.highestSeverity : "none";
    const headerLine = truncate(ctx, `${column.findingCount} · ${severityLabel} · risk ${column.riskScore}`, CELL_WIDTH);
    ctx.fillText(headerLine, x, PADDING + 16);

    column.cells.forEach((cell, rowIndex) => {
      const y = PADDING + HEADER_HEIGHT + rowIndex * (CELL_HEIGHT + CELL_GAP);
      ctx.fillStyle = heatColorFor(palette, cell.heatTier, cell.heatIntensity);
      ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);
      ctx.strokeStyle = `hsl(${palette.border})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, CELL_WIDTH - 1, CELL_HEIGHT - 1);

      ctx.fillStyle = `hsl(${palette.text})`;
      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillText(truncate(ctx, cell.id, CELL_WIDTH - 8), x + 4, y + 9);
    });
  });

  // Legend, drawn along the bottom.
  const legendY = height - LEGEND_HEIGHT + 12;
  const legendEntries: Array<[string, string]> = [
    ["No findings", heatColorFor(palette, "none", 0)],
    ["Informational", heatColorFor(palette, "informational", 0.7)],
    ["Warning", heatColorFor(palette, "warning", 0.7)],
    ["Critical", heatColorFor(palette, "critical", 0.7)],
  ];
  let legendX = PADDING;
  ctx.font = "10px system-ui, sans-serif";
  for (const [label, color] of legendEntries) {
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.strokeStyle = `hsl(${palette.border})`;
    ctx.strokeRect(legendX + 0.5, legendY + 0.5, 11, 11);
    ctx.fillStyle = `hsl(${palette.mutedText})`;
    ctx.fillText(label, legendX + 16, legendY + 2);
    legendX += 16 + ctx.measureText(label).width + 20;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode the heatmap as PNG."));
    }, "image/png");
  });
}
