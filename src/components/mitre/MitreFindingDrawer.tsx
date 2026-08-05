import * as React from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import type { EvtxEvent } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreTechniqueSummary } from "@/lib/mitre/types";
import { getAffectedEventIds } from "@/lib/mitre/statistics";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MitreIOCTimeline } from "@/components/mitre/MitreIOCTimeline";

export interface MitreFindingDrawerProps {
  /** Only read while `open` — the drawer keeps showing whatever it last
   * had while its own close animation plays, matching
   * `EventDetailsDrawer`'s same convention. */
  technique: MitreTechniqueSummary | null;
  open: boolean;
  onClose: () => void;
  /** Full case event set, used only to resolve each finding's `eventId`
   * (an `EvtxEvent.id`, not a display value) into a summary line for
   * "Affected Events" — the same `events.find(e => e.id === ...)` lookup
   * `IOCFindingsPanel.tsx` already does, not a re-scan of anything the
   * detection engine computed. */
  events: EvtxEvent[];
  /** Sprint 5.9.2, Step 7 — clicking an event anywhere in this drawer
   * (Affected Events tab, or the Overview tab's IOC Timeline) calls this
   * instead of navigating away to the Evidence Viewer (Sprint 5.9.1's
   * behavior). `MitreAttackPage` uses it to open the existing,
   * `React.memo`-wrapped `EventDetailsDrawer` inline, stacked on top of
   * this drawer — reusing that component rather than re-implementing an
   * event inspector here, per this sprint's "Reuse existing drawer. No
   * duplicate implementation." instruction. */
  onSelectEvent: (event: EvtxEvent) => void;
  /** Sprint 5.9.3, Step 7 ("Event Synchronization") — clicking an IOC in
   * the Overview tab's timeline or the IOC Findings tab marks it selected.
   * Every finding in this drawer already shares the same technique (this
   * drawer only ever shows one technique's findings), so selecting an IOC
   * can't change which cell the matrix highlights — it gives visible,
   * per-finding confirmation on top of the technique-level highlight
   * that's already active for as long as this drawer is open. Optional:
   * when omitted, findings simply aren't selectable (no regression for
   * any caller that doesn't wire it up). */
  onSelectFinding?: (finding: DetectionFinding) => void;
  selectedFindingId?: string | null;
}

const SEVERITY_VARIANT: Record<DetectionFinding["severity"], NonNullable<BadgeProps["variant"]>> = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
};

type DrawerTab = "overview" | "events" | "recommendations" | "findings" | "raw";

/**
 * Investigation Drawer for a single MITRE technique (Sprint 5.9.1, Step 9;
 * expanded into a full tabbed workspace by Sprint 5.9.2, Step 5). Opened by
 * a Coverage Matrix cell click, a chart click, or a Technique Table row
 * click — all three funnel into the same `filters.technique` selection in
 * `MitreAttackPage.tsx`. Presentation only: everything it renders was
 * already computed by `lib/mitre/aggregation.ts` — no new scanning or
 * detection happens here.
 *
 * Five tabs: Overview (description + quick stats + chronological IOC
 * Timeline), Affected Events, Recommendations, IOC Findings, and Raw
 * Detection (the underlying `DetectionFinding` records, unformatted, for
 * analysts who want the exact engine output — mirrors
 * `EventDetailsDrawer.tsx`'s existing "Raw XML" disclosure for the same
 * "give me the unprocessed data" need).
 */
function MitreFindingDrawerImpl({
  technique,
  open,
  onClose,
  events,
  onSelectEvent,
  onSelectFinding,
  selectedFindingId = null,
}: MitreFindingDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<DrawerTab>("overview");

  // Reset to the Overview tab every time a *different* technique opens,
  // rather than remembering whichever tab the previous technique was left
  // on — same "adjust state during render" pattern (react.dev/learn/
  // you-might-not-need-an-effect) `EventDetailsDrawer.tsx` already uses
  // for its Raw XML disclosure, avoiding a `useEffect` + `setState`
  // cascading-render flag from this repo's React-Compiler-aware lint
  // rules (react-hooks/set-state-in-effect).
  const [lastTechniqueId, setLastTechniqueId] = React.useState(technique?.id ?? null);
  if ((technique?.id ?? null) !== lastTechniqueId) {
    setLastTechniqueId(technique?.id ?? null);
    setActiveTab("overview");
  }

  const eventsById = React.useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const affectedEvents = React.useMemo(() => {
    if (!technique) return [];
    const seen = new Set<string>();
    const result: EvtxEvent[] = [];
    for (const finding of technique.findings) {
      if (seen.has(finding.eventId)) continue;
      const event = eventsById.get(finding.eventId);
      if (event) {
        seen.add(finding.eventId);
        result.push(event);
      }
    }
    return result;
  }, [technique, eventsById]);

  const recommendations = React.useMemo(() => {
    if (!technique) return [];
    return Array.from(new Set(technique.findings.map((f) => f.recommendation).filter(Boolean)));
  }, [technique]);

  // Same dedup contract `getAffectedEventIds` documents — used here only
  // for the Overview tab's "Affected Events" count, so that count and the
  // Affected Events tab's own list can never drift out of sync with each
  // other or with the Technique Table's "Has Events" filter.
  const affectedEventIdCount = technique ? getAffectedEventIds(technique).length : 0;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 lg:w-[560px] lg:max-w-[600px]">
        {technique && (
          <>
            <SheetHeader className="gap-1 border-b border-border px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>{technique.name}</SheetTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {technique.id}
                </Badge>
                {technique.highestSeverity && (
                  <Badge variant={SEVERITY_VARIANT[technique.highestSeverity]} className="capitalize">
                    {technique.highestSeverity}
                  </Badge>
                )}
              </div>
              <SheetDescription>{technique.tactic}</SheetDescription>
            </SheetHeader>

            <div className="border-b border-border px-6 py-3">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DrawerTab)}>
                <TabsList aria-label="Technique details">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="events">Affected Events</TabsTrigger>
                  <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                  <TabsTrigger value="findings">IOC Findings</TabsTrigger>
                  <TabsTrigger value="raw">Raw Detection</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea key={technique.id} className="flex-1">
              <div className="px-6 py-5">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DrawerTab)}>
                  <TabsContent value="overview" className="flex flex-col gap-6">
                    <div>
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Description
                      </h3>
                      <p className="text-sm text-foreground">
                        {technique.description || "No description available for this technique."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Findings</p>
                        <p className="mt-1 font-mono text-lg text-foreground">{technique.findingCount}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Events</p>
                        <p className="mt-1 font-mono text-lg text-foreground">{affectedEventIdCount}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tactic</p>
                        <p className="mt-1 truncate text-sm font-medium text-foreground" title={technique.tactic}>
                          {technique.tactic}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        IOC Timeline
                      </h3>
                      <MitreIOCTimeline
                        findings={technique.findings}
                        eventsById={eventsById}
                        onSelectEvent={onSelectEvent}
                        onSelectFinding={onSelectFinding}
                        selectedFindingId={selectedFindingId}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="events">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Affected Events ({affectedEvents.length})
                    </h3>
                    {affectedEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        The events behind these findings are no longer present in the currently loaded dataset.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {affectedEvents.map((event) => (
                          <li key={event.id}>
                            <button
                              type="button"
                              onClick={() => onSelectEvent(event)}
                              className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="min-w-0 flex-1 truncate text-foreground">
                                Event {event.eventId} — {event.provider || "Unknown"} — {event.computer || "Unknown"}
                              </span>
                              <span className="shrink-0 font-mono text-muted-foreground">
                                {event.timestamp ? format(new Date(event.timestamp), "MMM d, HH:mm:ss") : "Unknown"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="recommendations">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Recommendations
                    </h3>
                    {recommendations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recommendations available.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {recommendations.map((recommendation) => (
                          <li key={recommendation} className="text-sm text-foreground/90">
                            • {recommendation}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="findings">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mapped IOC Findings ({technique.findings.length})
                    </h3>
                    <div className="flex flex-col gap-2">
                      {technique.findings.map((finding) => {
                        const selected = finding.id === selectedFindingId;
                        return (
                          <Card
                            key={finding.id}
                            tabIndex={onSelectFinding ? 0 : undefined}
                            onClick={onSelectFinding ? () => onSelectFinding(finding) : undefined}
                            onKeyDown={
                              onSelectFinding
                                ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      onSelectFinding(finding);
                                    }
                                  }
                                : undefined
                            }
                            aria-label={onSelectFinding ? `Select finding: ${finding.title}${selected ? " — selected" : ""}` : undefined}
                            className={cn(
                              onSelectFinding &&
                                "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selected && "border-primary ring-1 ring-primary",
                            )}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={SEVERITY_VARIANT[finding.severity]} className="capitalize">
                                  {finding.severity}
                                </Badge>
                                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {finding.ruleName}
                                </span>
                              </div>
                              <p className="mt-1.5 text-sm font-medium text-foreground">{finding.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{finding.description}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="raw">
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Raw Detection Output ({technique.findings.length})
                    </h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Unformatted `DetectionFinding` records exactly as the IOC Detection Engine produced them —
                      the same data every other tab in this drawer presents, shown here without interpretation.
                    </p>
                    <div className="flex flex-col gap-2">
                      {technique.findings.map((finding) => (
                        <pre
                          key={finding.id}
                          className="overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px] text-foreground"
                        >
                          {JSON.stringify(finding, null, 2)}
                        </pre>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            <div className="flex flex-row items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export const MitreFindingDrawer = React.memo(MitreFindingDrawerImpl);
