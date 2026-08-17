import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";

import { formatDate } from "@/lib/statistics";
import { EXPORT_FORMAT_LABEL } from "@/lib/export/types";
import { useExportHistoryStore, useHydrateExportHistory } from "@/store/exportStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportEmptyState } from "@/components/export/ExportEmptyState";

/**
 * "12. Export History" — the latest 10 exports made from this browser
 * (`lib/export/history.ts` already caps the persisted list at 10; this
 * component just renders whatever the store currently mirrors). Metadata
 * only — filename/format/timestamp/status — never the exported file
 * itself, matching this phase's "Do NOT store exported files" instruction.
 */
export function ExportHistory() {
  useHydrateExportHistory();
  const entries = useExportHistoryStore((s) => s.entries);
  const clear = useExportHistoryStore((s) => s.clear);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Export History</CardTitle>
          <CardDescription>Your last 10 exports on this device.</CardDescription>
        </div>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clear}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <ExportEmptyState />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {entries.map((entry) => {
              const timestamp = new Date(entry.timestamp);
              const hasValidTimestamp = !Number.isNaN(timestamp.getTime());
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    {entry.status === "success" ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-severity-normal"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="h-4 w-4 shrink-0 text-severity-critical"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate text-foreground" title={entry.filename}>
                      {entry.filename}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{EXPORT_FORMAT_LABEL[entry.format]}</Badge>
                    <span title={hasValidTimestamp ? formatDate(timestamp) : undefined}>
                      {hasValidTimestamp ? formatDistanceToNow(timestamp, { addSuffix: true }) : "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
