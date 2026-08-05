import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, FileText, Files, Loader2 } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LoadStatus } from "@/types/evidence";

export interface SelectedFilesCardProps {
  /** The browser Files the user selected/dropped — read-only, never mutated. */
  files: File[];
  status: LoadStatus;
  /** Merged event count once the pipeline reaches "ready"; null while unknown. */
  eventCount: number | null;
  /** Names of files that failed to parse (evidenceStore.failedFiles). */
  failedFiles: string[];
  className?: string;
}

type OverallStatusKey = "ready" | "parsing" | "success" | "partial" | "error";

const STATUS_CONFIG: Record<
  OverallStatusKey,
  { label: string; icon: typeof Loader2; variant: NonNullable<BadgeProps["variant"]> }
> = {
  ready: { label: "Ready", icon: Files, variant: "outline" },
  parsing: { label: "Parsing", icon: Loader2, variant: "warning" },
  success: { label: "Parsed Successfully", icon: CheckCircle2, variant: "success" },
  partial: { label: "Parsed With Errors", icon: AlertCircle, variant: "warning" },
  error: { label: "Error", icon: AlertCircle, variant: "destructive" },
};

function resolveOverallStatus(
  status: LoadStatus,
  failedFiles: string[],
  fileCount: number,
): OverallStatusKey {
  switch (status) {
    case "idle":
      return "ready";
    case "parsing":
    case "analyzing":
      return "parsing";
    case "error":
      return "error";
    case "ready":
      return failedFiles.length > 0 && failedFiles.length < fileCount ? "partial" : "success";
  }
}

/**
 * Multi-file counterpart to `FileInfoCard` (Phase 5.7 — Multi-EVTX
 * Investigation). Shown instead of `FileInfoCard` whenever more than one
 * file is selected, so the analyst can see every selected filename before
 * (and during) parsing — `FileInfoCard` itself is left untouched and keeps
 * handling the single-file case exactly as before, so this component only
 * exists to cover the new multi-file path.
 */
export function SelectedFilesCard({ files, status, eventCount, failedFiles, className }: SelectedFilesCardProps) {
  const overall = resolveOverallStatus(status, failedFiles, files.length);
  const config = STATUS_CONFIG[overall];
  const isSpinning = overall === "parsing";
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const failedSet = new Set(failedFiles);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
    >
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Files className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {files.length.toLocaleString()} EVTX files selected
            </p>
            <p className="text-xs text-muted-foreground">{formatFileSize(totalSize)} total</p>
          </div>

          <Badge variant={config.variant} className="shrink-0 gap-1.5">
            <config.icon className={cn("h-3 w-3", isSpinning && "animate-spin")} aria-hidden="true" />
            {config.label}
            {overall === "success" && eventCount !== null && ` — ${eventCount.toLocaleString()} events`}
          </Badge>
        </CardHeader>

        <Separator />

        <CardContent className="max-h-56 overflow-y-auto pt-4">
          <ul className="space-y-2">
            {files.map((file) => {
              const failed = failedSet.has(file.name);
              return (
                <li
                  key={`${file.name}-${file.lastModified}-${file.size}`}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <FileText
                    className={cn("h-4 w-4 shrink-0", failed ? "text-destructive" : "text-muted-foreground")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                  {failed && (
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      Failed
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
