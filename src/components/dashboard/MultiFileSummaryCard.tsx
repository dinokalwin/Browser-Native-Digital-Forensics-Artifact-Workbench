import { Clock, Files, Layers } from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDuration } from "@/lib/statistics";
import { formatFileSize } from "@/lib/utils";
import type { PerFileStatistics } from "@/lib/multiFile";

interface MultiFileSummaryCardProps {
  fileCount: number;
  mergedEventCount: number;
  earliestTimestamp: Date | null;
  latestTimestamp: Date | null;
  perFile: PerFileStatistics[];
}

/**
 * "Files Loaded / Merged Event Count / Timeline Span" (Phase 5.7 — Multi-
 * EVTX Investigation), plus a compact per-file breakdown below. Only
 * rendered by `DashboardPage` when more than one file is loaded — a
 * single-file case already shows this information via `StatisticsCards`
 * and the Navbar/CaseStateGate filename, so this component would be pure
 * redundancy there. Purely presentational: every value comes from props
 * computed upstream (`lib/multiFile.ts#computePerFileStatistics`), no
 * aggregation happens here.
 */
export function MultiFileSummaryCard({
  fileCount,
  mergedEventCount,
  earliestTimestamp,
  latestTimestamp,
  perFile,
}: MultiFileSummaryCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard
          label="Files Loaded"
          value={fileCount}
          icon={Files}
          description="EVTX files merged into this case"
          accentClassName="bg-primary/10 text-primary"
        />
        <StatCard
          label="Merged Event Count"
          value={mergedEventCount}
          icon={Layers}
          description="Events across all loaded files"
          accentClassName="bg-severity-normal/15 text-severity-normal"
        />
        <StatCard
          label="Timeline Span"
          value={formatDuration(earliestTimestamp, latestTimestamp)}
          icon={Clock}
          description="First to last event across all files"
          accentClassName="bg-severity-warning/15 text-severity-warning"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <ul className="divide-y divide-border">
            {perFile.map((file) => (
              <li key={file.fileName} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground" title={file.fileName}>
                  {file.fileName}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {file.eventCount.toLocaleString()} events · {formatFileSize(file.sizeBytes)}
                  {file.earliestTimestamp && file.latestTimestamp && (
                    <> · {formatDate(file.earliestTimestamp)} – {formatDate(file.latestTimestamp)}</>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
