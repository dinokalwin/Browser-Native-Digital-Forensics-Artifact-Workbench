import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ExportStage, ExportStatus } from "@/lib/export/types";

const STAGE_LABEL: Record<Exclude<ExportStage, "idle">, string> = {
  preparing: "Preparing…",
  generating: "Generating…",
  packaging: "Packaging…",
  downloading: "Downloading…",
  completed: "Completed",
  failed: "Failed",
};

interface ExportProgressProps {
  status: ExportStatus;
}

/**
 * Per-card progress indicator (ticket "11. Export Progress") — Preparing /
 * Generating / Packaging / Downloading / Completed, or a clear error
 * message on failure. Renders nothing while `status.stage === "idle"` so
 * an untouched card stays visually quiet; `ExportCard.tsx` reserves no
 * fixed height for this, so it appears/disappears without reflowing the
 * grid around it.
 *
 * `role="status"`/`aria-live="polite"` (ticket "17. Accessibility" —
 * "Screen-reader friendly progress") announces each stage change without
 * needing a separate `sr-only` live region: the visible text *is* the
 * announced text.
 */
export function ExportProgress({ status }: ExportProgressProps) {
  if (status.stage === "idle") return null;

  const isFailed = status.stage === "failed";
  const isDone = status.stage === "completed";
  const label = isFailed && status.error ? status.error : STAGE_LABEL[status.stage];

  return (
    <div className="flex items-center gap-1.5 text-xs" role="status" aria-live="polite">
      {isFailed ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-severity-critical" aria-hidden="true" />
      ) : isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-severity-normal" aria-hidden="true" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
      )}
      <span
        className={cn(
          "truncate",
          isFailed && "text-severity-critical",
          isDone && "text-severity-normal",
          !isFailed && !isDone && "text-muted-foreground",
        )}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}
