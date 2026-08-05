import { Crosshair, FileText } from "lucide-react";

import type { InvestigationSummary } from "@/types/evidence";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InvestigationSummaryPanelProps {
  summary: InvestigationSummary;
  /** Sprint 5.9.4 — "MITRE Summary" (Step 2), e.g. "Observed 8 ATT&CK
   * techniques across 5 tactics. Credential Access and Persistence
   * represent the highest-risk areas." Built by `DashboardPage` via
   * `lib/mitre/statistics.ts#buildMitreSummarySentence` and passed in as
   * plain text — this panel stays presentation-only and the protected
   * `InvestigationSummary` shape (src/types/evidence.ts,
   * src/backend/investigation-summary.ts) is never touched. Optional: an
   * `undefined`/empty case with no MITRE findings simply omits the block. */
  mitreSummarySentence?: string;
}

/** Rule-based case narrative (see src/backend/investigation-summary.ts). */
export function InvestigationSummaryPanel({ summary, mitreSummarySentence }: InvestigationSummaryPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          Investigation Summary
        </CardTitle>
        <CardDescription>{summary.headline}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-foreground">{summary.narrative}</p>

        {mitreSummarySentence && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
            <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-severity-critical" aria-hidden="true" />
            <div>
              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                MITRE Summary
              </p>
              <p className="text-sm text-foreground">{mitreSummarySentence}</p>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Key findings
          </p>
          <ul className="flex flex-col gap-1">
            {summary.keyFindings.map((item, i) => (
              <li key={i} className="text-sm text-foreground">
                &bull; {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Affected hosts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.affectedHosts.map((host) => (
              <Badge key={host} variant="outline">
                {host}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
