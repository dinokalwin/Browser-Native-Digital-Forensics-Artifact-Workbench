import * as React from "react";
import { useNavigate } from "react-router-dom";

import { useEvidenceStore } from "@/store/evidenceStore";
import { getTechniqueInfo } from "@/lib/mitre/mapping";
import { Badge } from "@/components/ui/badge";

interface TechniqueBadgesProps {
  /** EvtxEvent.id for this row. */
  eventId: string;
}

/**
 * Small "ATT&CK techniques this event's IOC findings map to" badge row
 * (Sprint 5.9.4, Step 5 — "Every timeline entry shows ATT&CK badges.
 * Clicking one opens the MITRE page focused on that technique."). Mirrors
 * `IOCIndicator`/`NoteIndicator`/`BookmarkIndicator`'s established
 * self-contained pattern: reads `evidenceStore.iocFindingsByEvent`
 * directly rather than being prop-drilled, so `TimelineEntry` (and any
 * future caller) doesn't need to thread findings through itself. Renders
 * nothing when the event has no MITRE-mapped findings.
 *
 * Deliberately real `<button>` elements, not the row's own click target —
 * see `TimelineEntry.tsx`'s doc comment on why its row had to move from a
 * `<button>` to a `tabIndex`-managed `<div>` to host these without
 * producing invalid button-in-button HTML. Each click stops propagation so
 * selecting a technique doesn't also select the timeline row underneath
 * it, then navigates to the MITRE ATT&CK page with `{ focusTechniqueId }`
 * router state — `MitreAttackPage.tsx` reads that on arrival (Sprint
 * 5.9.4, Step 6 in that page's own doc comment) to open the matching
 * technique's Investigation Drawer, exactly as if the analyst had clicked
 * that cell in the Coverage Matrix themselves.
 */
function TechniqueBadgesImpl({ eventId }: TechniqueBadgesProps) {
  const navigate = useNavigate();
  const findings = useEvidenceStore((s) => s.iocFindingsByEvent[eventId]);

  const techniqueIds = React.useMemo(() => {
    if (!findings || findings.length === 0) return [];
    return Array.from(new Set(findings.map((f) => f.mitreTechnique).filter((id): id is string => Boolean(id))));
  }, [findings]);

  if (techniqueIds.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {techniqueIds.map((techniqueId) => {
        const info = getTechniqueInfo(techniqueId);
        return (
          <button
            key={techniqueId}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/dashboard/mitre", { state: { focusTechniqueId: techniqueId } });
            }}
            title={`Open ${techniqueId}${info ? ` — ${info.name}` : ""} in the MITRE ATT&CK page`}
            aria-label={`Open technique ${techniqueId}${info ? `, ${info.name}` : ""} in the MITRE ATT&CK page`}
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge
              variant="outline"
              className="cursor-pointer font-mono text-[9px] transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {techniqueId}
            </Badge>
          </button>
        );
      })}
    </span>
  );
}

export const TechniqueBadges = React.memo(TechniqueBadgesImpl);
