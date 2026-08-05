import { FileDown, Image, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MitreMatrixExportControlsProps {
  onExportCsv: () => void;
  onExportPng: () => void;
  /** PNG encoding (`canvas.toBlob`) is asynchronous — this disables the
   * button and swaps its icon for a spinner while one is in flight, rather
   * than allowing a second click to start a redundant second encode. CSV
   * export is synchronous (plain string building), so it has no analogous
   * loading state. */
  isExportingPng?: boolean;
  disabled?: boolean;
}

/**
 * Export controls for the Heatmap Matrix (Sprint 5.9.3, Step 9) — same
 * "small button row next to the section it exports" placement and Button
 * styling `ExportControls.tsx` already established for the Evidence
 * Table's CSV/JSON export, reused here rather than re-invented. The actual
 * export work (building the CSV text/Blob, drawing and encoding the PNG,
 * and triggering the download via `lib/download-blob.ts#downloadBlob`)
 * lives in `MitreAttackPage.tsx`'s handlers — this component only renders
 * the two buttons and forwards clicks, matching this feature's existing
 * "component is presentation, page owns the data/side-effects" split.
 */
export function MitreMatrixExportControls({
  onExportCsv,
  onExportPng,
  isExportingPng = false,
  disabled = false,
}: MitreMatrixExportControlsProps) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onExportCsv}
        disabled={disabled}
      >
        <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
        Export CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onExportPng}
        disabled={disabled || isExportingPng}
      >
        {isExportingPng ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Image className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Export PNG
      </Button>
    </div>
  );
}
