/**
 * Navigator Legend (Sprint 5.9.3, Step 4) — explains the Heatmap Matrix's
 * color/intensity encoding. Purely presentational, static content (no
 * props, no store reads) — the swatches use the exact same
 * `hsl(var(--x) / alpha)` formula `MitreCoverageMatrix.tsx#heatCellStyle`
 * paints real cells with, at a fixed mid-intensity, so what an analyst
 * sees here matches what they see on the grid rather than an
 * approximation of it.
 */
const LEGEND_TIERS: Array<{ label: string; description: string; variable: string }> = [
  { label: "No findings", description: "Technique not observed in this case", variable: "--muted" },
  { label: "Informational", description: "Highest matched finding is informational", variable: "--primary" },
  { label: "Warning", description: "Highest matched finding is a warning", variable: "--severity-warning" },
  { label: "Critical", description: "Highest matched finding is critical", variable: "--severity-critical" },
];

export function MitreHeatmapLegend() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/10 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {LEGEND_TIERS.map((tier) => (
          <div key={tier.label} className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-border/60"
              style={{ backgroundColor: `hsl(var(${tier.variable}) / 0.75)` }}
              aria-hidden="true"
            />
            <span className="text-foreground">{tier.label}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Intensity</span> scales with finding count — a technique with
        many matched findings renders more saturated than one with a single finding of the same severity, both
        floored at a minimum opacity so even a single finding stays clearly visible against the muted background.
      </p>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Observed vs. unobserved</span> — a colored cell means the
        detection engine matched at least one IOC finding to that technique in this case; a muted cell means the
        engine can detect that technique but nothing in this case triggered it.
      </p>
    </div>
  );
}
