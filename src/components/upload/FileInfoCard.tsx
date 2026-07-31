import { motion } from "framer-motion";
import { format } from "date-fns";
import { FileText, Loader2, CheckCircle2, AlertCircle, Inbox, CircleDashed } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LoadStatus } from "@/types/evidence";

export interface FileInfoCardProps {
  /** The browser File the user selected/dropped — read-only, never mutated. */
  file: File;
  status: LoadStatus;
  /** Number of events extracted once the pipeline reaches "ready"; null while unknown. */
  eventCount: number | null;
  className?: string;
}

type CardStatusKey = "ready" | "parsing" | "success" | "empty" | "error";

const STATUS_CONFIG: Record<
  CardStatusKey,
  { label: string; icon: typeof Loader2; variant: NonNullable<BadgeProps["variant"]> }
> = {
  ready: { label: "Ready", icon: CircleDashed, variant: "outline" },
  parsing: { label: "Parsing", icon: Loader2, variant: "warning" },
  success: { label: "Parsed Successfully", icon: CheckCircle2, variant: "success" },
  empty: { label: "Empty Log", icon: Inbox, variant: "outline" },
  error: { label: "Error", icon: AlertCircle, variant: "destructive" },
};

/**
 * Maps the store's general-purpose `LoadStatus` (shared with
 * CaseStatusBadge, used across Dashboard/Evidence/Timeline) to this card's
 * own, more upload-flow-specific wording. Kept as a separate mapping rather
 * than reusing CaseStatusBadge's config: the two components serve different
 * contexts ("Case ready" makes sense once you're investigating; "Parsed
 * Successfully" / "Empty Log" is what matters at the point of upload).
 */
function resolveStatusKey(status: LoadStatus, eventCount: number | null): CardStatusKey {
  switch (status) {
    case "idle":
      return "ready";
    case "parsing":
    case "analyzing":
      return "parsing";
    case "error":
      return "error";
    case "ready":
      return eventCount === 0 ? "empty" : "success";
  }
}

/**
 * Professional summary card shown once a file has been selected on the
 * upload page: name, human-readable size, last-modified date, file type,
 * and a live status badge that tracks the same `evidenceStore` pipeline
 * DropZone already drives. Purely presentational — reads props only, never
 * touches the store or triggers parsing itself.
 */
export function FileInfoCard({ file, status, eventCount, className }: FileInfoCardProps) {
  const statusKey = resolveStatusKey(status, eventCount);
  const config = STATUS_CONFIG[statusKey];
  const isSpinning = statusKey === "parsing";

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
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">Windows Event Log (.evtx)</p>
          </div>

          <Badge variant={config.variant} className="shrink-0 gap-1.5">
            <config.icon
              className={cn("h-3 w-3", isSpinning && "animate-spin")}
              aria-hidden="true"
            />
            {config.label}
          </Badge>
        </CardHeader>

        <Separator />

        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Size</dt>
              <dd className="font-medium text-foreground">{formatFileSize(file.size)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last Modified</dt>
              <dd className="font-medium text-foreground">
                {format(new Date(file.lastModified), "MMM d, yyyy HH:mm")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Type</dt>
              <dd className="font-medium text-foreground">Windows Event Log (.evtx)</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </motion.div>
  );
}
