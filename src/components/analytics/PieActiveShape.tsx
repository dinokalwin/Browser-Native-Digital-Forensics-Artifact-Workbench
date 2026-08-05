import { Sector } from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";

/**
 * Phase 5.8 — UI/UX refinement only. Subtle "grow on hover" for donut
 * segments (`EventLevelChart`/`ThreatDistributionChart`), recharts' own
 * documented `activeShape` recipe: redraw the hovered sector slightly
 * larger via the same `<Sector>` primitive `<Pie>` already uses internally
 * for every segment, rather than a CSS transform (which would need to
 * account for each sector's own arc/transform-origin math to look right).
 * `PieSectorDataItem` is deep-imported from recharts' own type file — this
 * project already has one precedent for deep-importing a single type from
 * a dependency rather than its top-level export surface (`CellHookData`
 * from `jspdf-autotable`, see services/report/pdfSections.ts).
 */
export function renderPieActiveShape(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={typeof outerRadius === "number" ? outerRadius + 6 : outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}
