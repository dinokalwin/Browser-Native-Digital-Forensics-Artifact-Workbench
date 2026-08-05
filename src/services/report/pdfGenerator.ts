/**
 * Investigation Report — PDF orchestration (Sprint 5.1, restyled Sprint 5.2).
 *
 * This file owns page *flow* only: creating the document, sequencing the
 * cover/table-of-contents/sections in order, tracking which physical page
 * each section landed on, backfilling the table of contents once that's
 * known, and stamping a header/footer onto every page. All actual drawing
 * for each section lives in `pdfSections.ts`; all colors/typography
 * constants live in `pdfTheme.ts`; all reusable jsPDF primitives (badges,
 * tables, headings) live in `pdfPrimitives.ts`. This split is what keeps
 * this file itself small even though the report grew substantially larger
 * in Sprint 5.2.
 *
 * Public API is unchanged from Sprint 5.1 (`generateReportPdf`,
 * `downloadReportPdf`) so `GenerateReportButton.tsx`'s dynamic
 * `import("@/services/report/pdfGenerator")` keeps working exactly as
 * before — jsPDF/jspdf-autotable and everything in this directory are
 * still only fetched on demand, never part of the Dashboard's initial
 * bundle. `extras` is a new, optional second argument (defaulted to
 * `EMPTY_EXTRAS`), so any existing caller that only passes `data` still
 * compiles and still produces a valid report.
 */
import { jsPDF } from "jspdf";

import type { ReportData } from "@/lib/report";
import { downloadBlob } from "@/lib/download-blob";

import { drawPageFooter, drawPageHeader } from "./pdfPrimitives";
import {
  EMPTY_EXTRAS,
  buildSectionList,
  renderCoverPage,
  renderTableOfContents,
  type ReportPdfExtras,
} from "./pdfSections";

export type { ReportPdfExtras } from "./pdfSections";
export { EMPTY_EXTRAS } from "./pdfSections";

export function generateReportPdf(data: ReportData, extras: ReportPdfExtras = EMPTY_EXTRAS): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Page 1 — cover. Deliberately has no page header/thin-divider strip (see
  // drawPageHeader's callers below, which skip page 1) since the cover has
  // its own full-bleed banner design instead.
  renderCoverPage(doc, data);

  // Page 2 — table of contents. Left blank for now: section page numbers
  // aren't known until every section below has actually been rendered
  // (a large Bookmarked Events/Suspicious Events table can span several
  // pages, shifting every section after it), so this page is revisited via
  // `doc.setPage()` once rendering finishes. `doc.addPage()` always appends
  // at the *end* of the document regardless of which page is current, so
  // coming back to page 2 later doesn't disturb page ordering.
  doc.addPage();
  const tocPageNumber = doc.getNumberOfPages();

  const tocEntries: Array<{ title: string; page: number }> = [{ title: "Cover", page: 1 }];

  for (const section of buildSectionList(data, extras)) {
    doc.addPage();
    tocEntries.push({ title: section.title, page: doc.getNumberOfPages() });
    section.render(doc);
  }

  doc.setPage(tocPageNumber);
  renderTableOfContents(doc, tocEntries);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    if (page > 1) drawPageHeader(doc, data.cover.caseFilename);
    drawPageFooter(doc, page, totalPages);
  }

  return doc.output("blob");
}

function reportFilename(caseFilename: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = caseFilename.replace(/\.[^./]+$/, "") || "case";
  return `dfir-investigation-report-${base}-${stamp}.pdf`;
}

export function downloadReportPdf(data: ReportData, extras: ReportPdfExtras = EMPTY_EXTRAS): void {
  const blob = generateReportPdf(data, extras);
  downloadBlob(blob, reportFilename(data.cover.caseFilename));
}
