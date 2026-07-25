import { FileText } from "lucide-react";

import type { InvestigationSummary } from "@/types/evidence";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InvestigationSummaryPanelProps {
  summary: InvestigationSummary;
}

/** Rule-based case narrative (see src/backend/investigation-summary.ts). */
export function InvestigationSummaryPanel({ summary }: InvestigationSummaryPanelProps) {
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
