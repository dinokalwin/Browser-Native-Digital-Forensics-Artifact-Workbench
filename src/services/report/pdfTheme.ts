/**
 * Investigation Report — visual theme (Sprint 5.2).
 *
 * Pure constants only: no jsPDF, no React. Every color used anywhere in
 * `pdfSections.ts`/`pdfPrimitives.ts` is defined exactly once here so the
 * report has one consistent palette instead of ad-hoc RGB literals sprinkled
 * across render functions — see this sprint's "no duplicated layout code"
 * requirement.
 */
import type { EventLevel, RiskLevel, SuspicionSeverity } from "@/types/evidence";

export type RgbColor = [number, number, number];

export const APP_BRAND = "DFIR Workbench";
export const REPORT_TITLE = "Digital Forensics Investigation Report";
/** Shorter form of `REPORT_TITLE` used in the recurring per-page header
 * strip (`drawPageHeader`), where the cover's full subtitle would crowd a
 * two-line brand/filename/title block. */
export const REPORT_TITLE_SHORT = "Investigation Report";

/** Base palette. Section headers stay blue; table headers are gray per this
 * sprint's explicit "Blue section headers / Gray table headers" split. */
export const THEME = {
  primary: [37, 99, 235] as RgbColor, // blue-600 — section headers, banner, links
  primaryDark: [29, 78, 216] as RgbColor, // blue-700 — cover banner accent line
  text: [31, 41, 55] as RgbColor, // slate-800 — body text
  muted: [107, 114, 128] as RgbColor, // gray-500 — metadata/captions
  border: [209, 213, 219] as RgbColor, // gray-300 — rules, boxes
  tableHeader: [71, 85, 105] as RgbColor, // slate-600 — table head row fill
  rowStripe: [243, 244, 246] as RgbColor, // gray-100 — alternating row fill
  white: [255, 255, 255] as RgbColor,
};

/** Risk score coloring: Low = Green, Medium = Orange, High = Red (per this
 * sprint's spec), plus Critical as a distinct, darker red since `RiskLevel`
 * has four values, not three. */
export const RISK_COLOR: Record<RiskLevel, RgbColor> = {
  low: [22, 163, 74], // green-600
  medium: [217, 119, 6], // amber-600
  high: [220, 38, 38], // red-600
  critical: [153, 27, 27], // red-800
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** Suspicious-finding severity badges — distinct color per level. */
export const SEVERITY_COLOR: Record<SuspicionSeverity, RgbColor> = {
  informational: [37, 99, 235], // blue-600
  warning: [217, 119, 6], // amber-600
  critical: [153, 27, 27], // red-800
};

/** Event-level badges (Bookmarked Events table, etc.) — Critical and Error
 * get visually distinct reds per this sprint's "each should have distinct
 * colors" requirement (previously they shared one red). */
export const LEVEL_COLOR: Record<EventLevel, RgbColor> = {
  Critical: [153, 27, 27], // red-800
  Error: [220, 38, 38], // red-600
  Warning: [217, 119, 6], // amber-600
  Information: [37, 99, 235], // blue-600
  Verbose: [107, 114, 128], // gray-500
};
