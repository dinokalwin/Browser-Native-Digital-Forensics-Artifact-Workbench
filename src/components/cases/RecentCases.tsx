import * as React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { History, FolderOpen } from "lucide-react";

import { getRecentCases } from "@/lib/cases/statistics";
import { CASE_THREAT_BADGE_VARIANT, type CaseMetadata } from "@/lib/cases/types";
import { useCaseStore } from "@/store/caseStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentCasesProps {
  cases: CaseMetadata[];
  activeCaseId: string | null;
  className?: string;
}

/**
 * Dashboard "Recent Cases" panel (Phase 5.10) — the 5 most recently
 * *opened* investigations (`lib/cases/statistics.ts#getRecentCases`),
 * each a one-click link back into that case's Dashboard. Presentational
 * plus one small store action (`markOpened`, mirroring what `CasesPage`'s
 * own "Open" action does) — no metadata computation happens here.
 *
 * Since raw events are never persisted (this phase's "metadata only"
 * constraint), clicking a case that isn't the one currently loaded in
 * `evidenceStore` can't silently restore its data — see this component's
 * `handleOpen` and `CasesPage.tsx`'s identical handler for the shared
 * "navigate home with a re-upload prompt" fallback, factored as the same
 * small inline check in both places rather than a shared helper, since
 * each needs a different post-navigation destination context.
 */
export function RecentCases({ cases, activeCaseId, className }: RecentCasesProps) {
  const navigate = useNavigate();
  const markOpened = useCaseStore((s) => s.markOpened);

  const recent = React.useMemo(() => getRecentCases(cases, 5), [cases]);

  const handleOpen = (id: string) => {
    markOpened(id);
    if (id === activeCaseId) {
      navigate("/dashboard");
    } else {
      navigate("/dashboard/cases");
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <History className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm font-semibold text-foreground">Recent Cases</CardTitle>
          <CardDescription className="mt-0.5 text-xs">Your last {recent.length} investigations</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved cases yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.map((c) => {
              const lastOpened = new Date(c.lastOpened);
              const hasValidLastOpened = !Number.isNaN(lastOpened.getTime());
              const isActive = c.id === activeCaseId;

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(c.id)}
                    className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open case ${c.name}`}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground" title={c.name}>
                        {c.name}
                        {isActive && <span className="ml-1.5 text-[10px] font-normal text-primary">(open)</span>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {hasValidLastOpened ? formatDistanceToNow(lastOpened, { addSuffix: true }) : "Never opened"}
                      </span>
                    </span>
                    <Badge variant={CASE_THREAT_BADGE_VARIANT[c.threatLevel]} className="shrink-0 text-[10px]">
                      {c.threatScore}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
