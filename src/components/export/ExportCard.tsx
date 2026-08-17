import type { LucideIcon } from "lucide-react";
import { Download, Loader2 } from "lucide-react";

import { EXPORT_FORMAT_LABEL, isExportBusy, type ExportFormat, type ExportStatus } from "@/lib/export/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExportFormatSelector } from "@/components/export/ExportFormatSelector";
import { ExportProgress } from "@/components/export/ExportProgress";

interface ExportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  formats: readonly ExportFormat[];
  selectedFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  /** "13. UI — File size estimate if available" — omitted (not rendered)
   * when the caller can't cheaply estimate one (the PDF report and the ZIP
   * bundle, whose size depends on jsPDF/JSZip's own compression, aren't
   * worth a misleading guess). */
  sizeEstimateLabel?: string;
  status: ExportStatus;
  onExport: () => void;
}

/**
 * One export type's card (ticket "1. CREATE" / "13. UI"): icon, name,
 * description, format (a static badge for single-format cards, an
 * interactive `ExportFormatSelector` for the three multi-format ones),
 * size estimate, an Export button, and inline `ExportProgress`. Purely
 * presentational/controlled — `ExportCenter.tsx` owns every export's
 * status and format selection and decides what actually gets built.
 */
export function ExportCard({
  icon: Icon,
  title,
  description,
  formats,
  selectedFormat,
  onFormatChange,
  sizeEstimateLabel,
  status,
  onExport,
}: ExportCardProps) {
  const isBusy = isExportBusy(status);

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {formats.length > 1 ? (
            <ExportFormatSelector formats={formats} value={selectedFormat} onChange={onFormatChange} disabled={isBusy} />
          ) : (
            <Badge variant="outline">{EXPORT_FORMAT_LABEL[formats[0]]}</Badge>
          )}
          {sizeEstimateLabel && <span className="text-[11px] text-muted-foreground">~{sizeEstimateLabel}</span>}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <ExportProgress status={status} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            disabled={isBusy}
            aria-busy={isBusy}
            onClick={onExport}
          >
            {isBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isBusy ? "Exporting…" : `Export ${EXPORT_FORMAT_LABEL[selectedFormat]}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
