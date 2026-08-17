import { formatDistanceToNow } from "date-fns";
import { Bookmark, Crosshair, Files, FileText, Gauge, MoreVertical, Pencil, ShieldAlert, Trash2 } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";
import { formatDate } from "@/lib/statistics";
import { CASE_THREAT_BADGE_VARIANT, CASE_THREAT_LABEL, type CaseMetadata } from "@/lib/cases/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CaseCardProps {
  caseMetadata: CaseMetadata;
  /** True when this case is the investigation currently loaded in
   * `evidenceStore` — drawn with a primary ring so an analyst can tell
   * "this is the one I'm already looking at" apart from the rest of the
   * library at a glance. */
  isActive?: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * One case in the Case Library's Grid view (Phase 5.10). Presentation
 * only — every number here is read straight off the already-computed
 * `CaseMetadata` record; this component never touches `evidenceStore`,
 * `lib/mitre`, or the Detection Engine itself.
 *
 * The whole card is a `<button>` (opens the case) with a `DropdownMenu`
 * for the secondary Rename/Delete actions — the same "primary action on
 * the row/card itself, secondary actions behind a menu" shape
 * `IOCFindingsPanel.tsx` already uses, adapted here to a menu instead of
 * inline badges since Rename/Delete are destructive/mutating rather than
 * informational.
 */
export function CaseCard({ caseMetadata, isActive = false, onOpen, onRename, onDelete }: CaseCardProps) {
  const lastOpened = new Date(caseMetadata.lastOpened);
  const hasValidLastOpened = !Number.isNaN(lastOpened.getTime());

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col transition-shadow hover:shadow-md",
        isActive && "ring-2 ring-primary",
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onOpen(caseMetadata.id)}
            className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open case ${caseMetadata.name}`}
          >
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary" title={caseMetadata.name}>
              {caseMetadata.name}
            </p>
            <p
              className="mt-0.5 truncate text-xs text-muted-foreground"
              title={hasValidLastOpened ? formatDate(lastOpened) : undefined}
            >
              {isActive
                ? "Currently open"
                : hasValidLastOpened
                  ? `Opened ${formatDistanceToNow(lastOpened, { addSuffix: true })}`
                  : "Never opened"}
            </p>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                aria-label={`Case actions for ${caseMetadata.name}`}
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRename(caseMetadata.id)} className="gap-2">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(caseMetadata.id)}
                className="gap-2 text-severity-critical focus:bg-severity-critical/10 focus:text-severity-critical"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Badge variant={CASE_THREAT_BADGE_VARIANT[caseMetadata.threatLevel]} className="w-fit gap-1">
          <Gauge className="h-3 w-3" aria-hidden="true" />
          {CASE_THREAT_LABEL[caseMetadata.threatLevel]} · {caseMetadata.threatScore}/100
        </Badge>

        <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5" title="Events">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {caseMetadata.eventCount.toLocaleString()} events
          </span>
          <span className="flex items-center gap-1.5" title="IOC findings">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {caseMetadata.findingCount.toLocaleString()} findings
          </span>
          <span className="flex items-center gap-1.5" title="ATT&CK techniques observed">
            <Crosshair className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {caseMetadata.mitreTechniqueCount.toLocaleString()} techniques
          </span>
          <span className="flex items-center gap-1.5" title="Source files">
            <Files className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {caseMetadata.sourceFiles.length.toLocaleString()} file{caseMetadata.sourceFiles.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatFileSize(caseMetadata.fileSize)}</span>
          <span className="flex items-center gap-2.5">
            {caseMetadata.notesCount > 0 && (
              <span className="flex items-center gap-1" title={`${caseMetadata.notesCount} note${caseMetadata.notesCount === 1 ? "" : "s"}`}>
                <FileText className="h-3 w-3" aria-hidden="true" />
                {caseMetadata.notesCount}
              </span>
            )}
            {caseMetadata.bookmarksCount > 0 && (
              <span className="flex items-center gap-1" title={`${caseMetadata.bookmarksCount} bookmark${caseMetadata.bookmarksCount === 1 ? "" : "s"}`}>
                <Bookmark className="h-3 w-3" aria-hidden="true" />
                {caseMetadata.bookmarksCount}
              </span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
