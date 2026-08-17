import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";
import { formatDate } from "@/lib/statistics";
import { CASE_THREAT_BADGE_VARIANT, CASE_THREAT_LABEL, type CaseMetadata } from "@/lib/cases/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CaseListProps {
  cases: CaseMetadata[];
  activeCaseId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Case Library's List view (Phase 5.10) — the same `CaseMetadata` fields
 * `CaseGrid`/`CaseCard` show, laid out as a dense scannable table instead
 * of cards, for an analyst working through a long case history. Reuses
 * this project's shared `Table` primitive (`ui/table.tsx`, the same one
 * `EvidenceTable` is built on) rather than a bespoke list markup.
 */
export function CaseList({ cases, activeCaseId, onOpen, onRename, onDelete }: CaseListProps) {
  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case</TableHead>
            <TableHead>Threat</TableHead>
            <TableHead className="text-right">Events</TableHead>
            <TableHead className="text-right">Findings</TableHead>
            <TableHead className="text-right">Techniques</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Last Opened</TableHead>
            <TableHead className="w-10 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseMetadata) => {
            const lastOpened = new Date(caseMetadata.lastOpened);
            const hasValidLastOpened = !Number.isNaN(lastOpened.getTime());
            const isActive = caseMetadata.id === activeCaseId;

            return (
              <TableRow key={caseMetadata.id} data-state={isActive ? "selected" : undefined}>
                <TableCell className="max-w-[18rem]">
                  <button
                    type="button"
                    onClick={() => onOpen(caseMetadata.id)}
                    className="block w-full truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={caseMetadata.name}
                    aria-label={`Open case ${caseMetadata.name}`}
                  >
                    {caseMetadata.name}
                  </button>
                  {isActive && <span className="text-[11px] text-primary">Currently open</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={CASE_THREAT_BADGE_VARIANT[caseMetadata.threatLevel]} className={cn("whitespace-nowrap")}>
                    {CASE_THREAT_LABEL[caseMetadata.threatLevel]} · {caseMetadata.threatScore}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {caseMetadata.eventCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {caseMetadata.findingCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {caseMetadata.mitreTechniqueCount.toLocaleString()}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatFileSize(caseMetadata.fileSize)}
                </TableCell>
                <TableCell
                  className="whitespace-nowrap text-xs text-muted-foreground"
                  title={hasValidLastOpened ? formatDate(lastOpened) : undefined}
                >
                  {hasValidLastOpened ? formatDistanceToNow(lastOpened, { addSuffix: true }) : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
