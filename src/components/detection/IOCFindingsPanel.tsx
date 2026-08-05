import { useNavigate } from "react-router-dom";
import { Crosshair, ShieldCheck } from "lucide-react";

import type { DetectionFinding } from "@/lib/detection/types";
import type { EvtxEvent } from "@/types/evidence";
import { getTechniqueInfo } from "@/lib/mitre/mapping";
import { useUIStore } from "@/store/uiStore";
import { useFilterStore } from "@/store/filterStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const SEVERITY_VARIANT = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
} as const;

interface IOCFindingsPanelProps {
  findings: DetectionFinding[];
  events: EvtxEvent[];
}

/**
 * Phase 5.4 — Dashboard summary for the modular IOC Detection Engine
 * (src/lib/detection/), replacing the old `SuspiciousEventsPanel` (kept in
 * place, unmodified, but no longer rendered by DashboardPage). Same
 * click-to-jump-to-evidence interaction as the panel it replaces, plus
 * each finding's rule name, MITRE technique, and analyst recommendation —
 * the richer fields `DetectionFinding` carries that the old
 * `SuspiciousFinding` shape didn't.
 */
export function IOCFindingsPanel({ findings, events }: IOCFindingsPanelProps) {
  const navigate = useNavigate();
  const selectEvent = useUIStore((s) => s.selectEvent);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);

  const goToEvent = (finding: DetectionFinding) => {
    const event = events.find((e) => e.id === finding.eventId);
    if (!event) return;
    selectEvent(event);
    setSearchQuery(event.id);
    navigate("/dashboard/evidence");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Crosshair className="h-4 w-4 text-severity-critical" aria-hidden="true" />
          IOC Detections
        </CardTitle>
        <CardDescription>
          {findings.length === 0
            ? "No indicators of compromise matched the current rule set."
            : `${findings.length} IOC finding${findings.length === 1 ? "" : "s"} flagged by the detection engine.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {findings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
            <ShieldCheck className="h-6 w-6 text-severity-normal" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Nothing flagged for this case.</p>
          </div>
        ) : (
          <ScrollArea className="h-72">
            <ul className="flex flex-col gap-2 pr-3">
              {findings.map((finding) => {
                // Sprint 5.9.4 — IOC Findings, Step 3: every card now shows
                // Technique ID, Technique Name, and a MITRE tactic badge
                // (not just the ID this panel already showed) — resolved
                // via `lib/mitre/mapping.ts#getTechniqueInfo`, the same
                // reference table the MITRE ATT&CK page itself reads from,
                // so this card's technique name/tactic can never disagree
                // with that page's. `undefined` for a finding whose
                // `mitreTechnique` doesn't match a known technique (or has
                // none at all), in which case only the existing bare-ID
                // fallback badge renders, unchanged from before this sprint.
                const techniqueInfo = finding.mitreTechnique ? getTechniqueInfo(finding.mitreTechnique) : undefined;

                return (
                  <li key={finding.id}>
                    <button
                      type="button"
                      onClick={() => goToEvent(finding)}
                      className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={SEVERITY_VARIANT[finding.severity]} className="capitalize">
                          {finding.severity}
                        </Badge>
                        {finding.mitreTechnique && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {finding.mitreTechnique}
                          </Badge>
                        )}
                        {techniqueInfo && (
                          <span className="text-[10px] text-muted-foreground" title={techniqueInfo.name}>
                            {techniqueInfo.name}
                          </span>
                        )}
                        {techniqueInfo && (
                          <Badge variant="outline" className="text-[10px]">
                            {techniqueInfo.tactic}
                          </Badge>
                        )}
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                          {finding.ruleName}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-foreground">{finding.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{finding.description}</p>
                      <p className="mt-1.5 text-xs text-foreground/80">
                        <span className="font-medium">Recommendation: </span>
                        {finding.recommendation}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
