import * as React from "react";
import { format } from "date-fns";
import { ChevronRight, Copy, FileCode2 } from "lucide-react";
import { toast } from "sonner";

import type { EvtxEvent } from "@/types/evidence";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LevelBadge } from "@/components/evidence/level-badge";
import { EventNoteSection } from "@/components/notes/EventNoteSection";
import { BookmarkToggleButton } from "@/components/bookmarks/BookmarkToggleButton";
import { IOCDetailsSection } from "@/components/detection/IOCDetailsSection";

export interface EventDetailsDrawerProps {
  /** Event to display. Only read while `open` — the drawer keeps showing
   * whatever it last had while its own close animation plays, rather than
   * flashing empty. */
  selectedEvent: EvtxEvent | null;
  open: boolean;
  onClose: () => void;
  /**
   * Uploaded file name — the key investigator notes are namespaced under
   * (see lib/notes.ts). Passed down rather than read from evidenceStore
   * directly, keeping this component presentation-only per its existing
   * design (see the doc comment below).
   */
  caseId: string | null;
}

/** A parsed record's `raw` payload is `{ xml: string }` — see record-mapper.ts.
 * Typed `unknown` at the boundary, so this narrows it defensively rather
 * than assuming the shape holds for every event (a resilient inspector
 * should never crash on a malformed or missing `raw`). */
function extractRawXml(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "xml" in raw) {
    const xml = (raw as { xml: unknown }).xml;
    if (typeof xml === "string" && xml.length > 0) return xml;
  }
  return null;
}

async function copyToClipboard(text: string, successLabel: string): Promise<void> {
  try {
    if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    toast.success(successLabel);
  } catch {
    toast.error("Couldn't copy to clipboard", {
      description: "Your browser blocked clipboard access for this page.",
    });
  }
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-[65%] break-words text-right font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

/**
 * Full-detail inspector for a single event, opened from a row click in
 * EvidenceTable. Presentation only: reads `selectedEvent`/`caseId` and
 * renders them — no parsing, no filtering, no store access of its own
 * (its child `EventNoteSection` reads/writes `notesStore` for the
 * Investigator Notes feature, but that's an isolated concern scoped to
 * that one child, not this component reaching into a store directly).
 * `React.memo`-wrapped so it only re-renders when its own props
 * (selectedEvent/open/caseId) actually change, not whenever an unrelated
 * part of the dashboard re-renders.
 *
 * Escape/close-button/click-outside are all handled by Sheet's underlying
 * Radix Dialog primitive via `onOpenChange` below — nothing extra needed
 * here for any of the three.
 */
function EventDetailsDrawerImpl({
  selectedEvent,
  open,
  onClose,
  caseId,
}: EventDetailsDrawerProps) {
  const [xmlExpanded, setXmlExpanded] = React.useState(false);

  // Collapsed by default every time a *different* event is opened, rather
  // than remembering whichever state the previous event's XML section was
  // left in. Using React's own recommended "adjust state during render"
  // pattern (react.dev/learn/you-might-not-need-an-effect) rather than a
  // `useEffect` + `setState` — this repo's React-Compiler-aware lint rules
  // (react-hooks/set-state-in-effect) flag that as a cascading-render risk;
  // this project hit the same thing in FilterToolbar.tsx (Sprint 3.3).
  const [lastEventId, setLastEventId] = React.useState(selectedEvent?.id ?? null);
  if ((selectedEvent?.id ?? null) !== lastEventId) {
    setLastEventId(selectedEvent?.id ?? null);
    setXmlExpanded(false);
  }

  const rawXml = selectedEvent ? extractRawXml(selectedEvent.raw) : null;
  const hasMessage = Boolean(selectedEvent?.message);

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 lg:w-[560px] lg:max-w-[600px]"
      >
        {selectedEvent && (
          <>
            <SheetHeader className="gap-1 border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <SheetTitle>Event {selectedEvent.eventId}</SheetTitle>
                <LevelBadge level={selectedEvent.level} />
              </div>
              <SheetDescription>{selectedEvent.provider || "Unknown provider"}</SheetDescription>
            </SheetHeader>

            <ScrollArea key={selectedEvent.id} className="flex-1">
              <div className="flex flex-col gap-6 px-6 py-5">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      General Information
                    </h3>
                    <dl className="divide-y divide-border">
                      <DetailRow label="Event ID" value={selectedEvent.eventId} />
                      <DetailRow label="Provider" value={selectedEvent.provider || "Unknown"} />
                      <DetailRow label="Level" value={<LevelBadge level={selectedEvent.level} />} />
                      <DetailRow label="Computer" value={selectedEvent.computer || "Unknown"} />
                      <DetailRow label="Channel" value={selectedEvent.channel || "Unknown"} />
                      {selectedEvent.user && (
                        <DetailRow label="Username" value={selectedEvent.user} />
                      )}
                      <DetailRow
                        label="Time Generated"
                        value={
                          selectedEvent.timestamp
                            ? format(new Date(selectedEvent.timestamp), "MMM d, yyyy HH:mm:ss")
                            : "Unknown"
                        }
                      />
                    </dl>
                  </CardContent>
                </Card>

                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Message
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {hasMessage ? selectedEvent.message : "No message available for this event."}
                  </p>
                </div>

                <Separator />

                <IOCDetailsSection eventId={selectedEvent.id} />

                <EventNoteSection caseId={caseId} eventId={selectedEvent.id} />

                <Separator />

                <div>
                  <button
                    type="button"
                    onClick={() => setXmlExpanded((v) => !v)}
                    aria-expanded={xmlExpanded}
                    className="flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 transition-transform", xmlExpanded && "rotate-90")}
                      aria-hidden="true"
                    />
                    Raw XML
                  </button>

                  {xmlExpanded && (
                    <div className="mt-2 max-h-80 overflow-auto rounded-md border border-border bg-muted/40">
                      <pre className="min-w-max whitespace-pre p-3 font-mono text-xs text-foreground">
                        {rawXml ?? "No raw XML available for this event."}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <div className="flex flex-row items-center justify-end gap-2 border-t border-border px-6 py-4">
              <BookmarkToggleButton caseId={caseId} eventId={selectedEvent.id} className="mr-auto" />
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMessage}
                onClick={() => copyToClipboard(selectedEvent.message, "Message copied to clipboard")}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy Message
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!rawXml}
                onClick={() => rawXml && copyToClipboard(rawXml, "Raw XML copied to clipboard")}
                className="gap-1.5"
              >
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                Copy XML
              </Button>
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

export const EventDetailsDrawer = React.memo(EventDetailsDrawerImpl);
