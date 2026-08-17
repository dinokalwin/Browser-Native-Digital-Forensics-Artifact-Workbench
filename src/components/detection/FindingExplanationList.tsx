import { Check, TriangleAlert } from "lucide-react";

import type { DetectionFinding } from "@/lib/detection/types";
import { getFindingExplanation } from "@/lib/detection/context/contextScoring";

interface FindingExplanationListProps {
  finding: DetectionFinding;
  /** Compact mode drops the summary sentence and shrinks text — used by
   * `IOCFindingsPanel`'s cards, where space is tighter than the Event
   * Details Drawer's expandable section. */
  compact?: boolean;
}

/**
 * Phase 5.13 — "Why was this detected?" (ticket sections 13/17/18).
 * Renders `getFindingExplanation()`'s structured signal split as two
 * bullet lists — legitimacy indicators (✓, green-ish) and risk factors
 * (▲, amber/red) — each line pairing an icon (not color alone, per
 * accessibility section 29) with its label and signed point weight.
 * Presentational only: performs no scoring itself.
 */
export function FindingExplanationList({ finding, compact = false }: FindingExplanationListProps) {
  const explanation = getFindingExplanation(finding);

  if (explanation.positiveSignals.length === 0 && explanation.negativeSignals.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No additional context signals were available for this finding — confidence reflects the base rule severity.
      </p>
    );
  }

  return (
    <div className={compact ? "flex flex-col gap-1" : "flex flex-col gap-2"}>
      {explanation.negativeSignals.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {explanation.negativeSignals.map((signal) => (
            <li key={signal.type} className="flex items-start gap-1.5 text-xs text-severity-warning">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">+{signal.weight}</span> {signal.label}
                {!compact && <span className="text-muted-foreground"> — {signal.description}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {explanation.positiveSignals.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {explanation.positiveSignals.map((signal) => (
            <li key={signal.type} className="flex items-start gap-1.5 text-xs text-severity-normal">
              <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{signal.weight}</span> {signal.label}
                {!compact && <span className="text-muted-foreground"> — {signal.description}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!compact && <p className="text-xs text-muted-foreground">{explanation.summary}</p>}
    </div>
  );
}
