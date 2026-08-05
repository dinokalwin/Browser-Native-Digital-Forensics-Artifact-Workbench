import * as React from "react";
import { Crosshair } from "lucide-react";

import { cn } from "@/lib/utils";
import { useEvidenceStore } from "@/store/evidenceStore";

interface IOCIndicatorProps {
  /** EvtxEvent.id for this row. */
  eventId: string;
}

/**
 * Small "this event matched one or more IOC findings" marker (Phase 5.4's
 * "Timeline: Show IOC icons on matching events" requirement) — mirrors
 * `NoteIndicator`/`BookmarkIndicator` exactly: reads its own data directly
 * rather than being prop-drilled, and only re-renders when *this* event's
 * own finding list changes. Unlike notes/bookmarks (per-case localStorage,
 * loaded via a `useEnsureCase*Loaded` hook), IOC findings are already
 * in-memory in `evidenceStore` from the file-load pipeline, grouped by
 * event id once at load time (`iocFindingsByEvent`) — so this is a direct
 * O(1) store lookup, no separate loading step needed.
 */
function IOCIndicatorImpl({ eventId }: IOCIndicatorProps) {
  const findings = useEvidenceStore((s) => s.iocFindingsByEvent[eventId]);

  if (!findings || findings.length === 0) return null;

  const hasCritical = findings.some((f) => f.severity === "critical");
  const label = `${findings.length} IOC finding${findings.length === 1 ? "" : "s"} matched this event`;

  return (
    <span title={label} className="inline-flex">
      <Crosshair
        className={cn("h-3.5 w-3.5", hasCritical ? "text-severity-critical" : "text-severity-warning")}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const IOCIndicator = React.memo(IOCIndicatorImpl);
