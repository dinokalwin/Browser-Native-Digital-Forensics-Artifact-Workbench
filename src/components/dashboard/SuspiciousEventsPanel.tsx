import { useNavigate } from "react-router-dom";
import { ShieldCheck, Siren } from "lucide-react";

import type { EvtxEvent, SuspiciousFinding } from "@/types/evidence";
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

interface SuspiciousEventsPanelProps {
  findings: SuspiciousFinding[];
  events: EvtxEvent[];
}

/**
 * Rule-based suspicious findings (see src/backend/suspicious-detection.ts).
 * Clicking a finding jumps to the Evidence Viewer with the triggering
 * event selected and searched for — reuses the same cross-panel
 * `uiStore.selectedEvent` link the table and timeline already write to.
 */
export function SuspiciousEventsPanel({ findings, events }: SuspiciousEventsPanelProps) {
  const navigate = useNavigate();
  const selectEvent = useUIStore((s) => s.selectEvent);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);

  const goToEvent = (finding: SuspiciousFinding) => {
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
          <Siren className="h-4 w-4 text-severity-critical" aria-hidden="true" />
          Suspicious Events
        </CardTitle>
        <CardDescription>
          {findings.length === 0
            ? "No suspicious patterns matched the current rule set."
            : `${findings.length} finding${findings.length === 1 ? "" : "s"} flagged by the rule-based detector.`}
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
              {findings.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    onClick={() => goToEvent(finding)}
                    className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[finding.severity]} className="capitalize">
                        {finding.severity}
                      </Badge>
                      {finding.mitreTechnique && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {finding.mitreTechnique}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-foreground">{finding.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{finding.description}</p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
