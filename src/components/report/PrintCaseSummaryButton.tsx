import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Phase 5 Item 3 — Printable Case Summary. Triggers the browser's native
 * print dialog via `window.print()` — no new PDF library, no second
 * report-generation pipeline. `@media print`/`print:` rules elsewhere
 * (DashboardPage.tsx, index.css, and the Navbar/Sidebar/MobileSidebar
 * components) hide everything except `CaseSummaryPrintView` when this
 * fires, and the browser's own print dialog already offers "Save as PDF"
 * as a destination, satisfying "printable/exportable" without a
 * duplicate export path.
 *
 * A plain native `<button>` (via the existing `Button` primitive) — no
 * custom keyboard handling needed, it's focusable and Enter/Space-
 * activatable for free, matching every other Phase-3-hardened control in
 * this app.
 */
export function PrintCaseSummaryButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      aria-label="Print case summary"
      onClick={() => window.print()}
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      Print Summary
    </Button>
  );
}
