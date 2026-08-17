import { PackageOpen } from "lucide-react";

/**
 * Small empty state for `ExportHistory.tsx` when nothing has been exported
 * yet from this browser — narrower in scope than the page-level "no case
 * loaded" gate (`ExportPage.tsx` reuses the existing `CaseStateGate` for
 * that, per this phase's "reuse existing" instruction; a case can
 * perfectly well be loaded with zero exports so far, which is exactly
 * this state).
 */
export function ExportEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PackageOpen className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">No exports yet. Files you export from this page will show up here.</p>
    </div>
  );
}
