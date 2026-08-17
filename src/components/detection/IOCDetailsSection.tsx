import { useNavigate } from "react-router-dom";
import { ChevronDown, Crosshair, Shield } from "lucide-react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { getTechniqueInfo } from "@/lib/mitre/mapping";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "@/components/detection/ConfidenceBadge";
import { FindingExplanationList } from "@/components/detection/FindingExplanationList";

const SEVERITY_VARIANT = {
  critical: "critical",
  warning: "warning",
  informational: "outline",
} as const;

interface IOCDetailsSectionProps {
  eventId: string;
}

/**
 * Phase 5.4's "Event Drawer: Display matching IOC information" — renders
 * every `DetectionFinding` matched to this event (title, severity, MITRE
 * technique, description, recommendation), reading `evidenceStore`'s
 * precomputed `iocFindingsByEvent` directly (same self-contained pattern
 * as `IOCIndicator`) rather than being passed the array as a prop. Renders
 * nothing when the event has no matching findings, so the drawer's layout
 * is unaffected for the common case.
 */
export function IOCDetailsSection({ eventId }: IOCDetailsSectionProps) {
  const navigate = useNavigate();
  const findings = useEvidenceStore((s) => s.iocFindingsByEvent[eventId]);

  if (!findings || findings.length === 0) return null;

  // Sprint 5.9.4, Step 4 — "ATT&CK Techniques" under IOC Details. Deduped,
  // insertion-ordered technique IDs across this event's findings (an event
  // can trigger more than one rule mapped to the same or different
  // techniques), resolved against the same `lib/mitre/mapping.ts` reference
  // table every other MITRE-aware surface in this app reads from.
  const techniqueIds = Array.from(
    new Set(findings.map((f) => f.mitreTechnique).filter((id): id is string => Boolean(id))),
  );

  const goToTechnique = (techniqueId: string) => {
    navigate("/dashboard/mitre", { state: { focusTechniqueId: techniqueId } });
  };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Crosshair className="h-3.5 w-3.5 text-severity-critical" aria-hidden="true" />
        Matching IOC Findings
      </h3>
      <div className="flex flex-col gap-3">
        {findings.map((finding) => (
          <div key={finding.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={SEVERITY_VARIANT[finding.severity]} className="capitalize">
                {finding.severity}
              </Badge>
              {finding.confidenceLevel && <ConfidenceBadge level={finding.confidenceLevel} score={finding.riskScore} />}
              {finding.mitreTechnique && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {finding.mitreTechnique}
                </Badge>
              )}
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {finding.ruleName}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium text-foreground">{finding.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{finding.description}</p>
            <p className="mt-2 text-xs text-foreground/80">
              <span className="font-medium">Recommendation: </span>
              {finding.recommendation}
            </p>
            {/* Phase 5.13 — ticket section 18: "Add an expandable 'Why was
                this detected?' section" rather than redesigning the
                drawer. Native <details>/<summary> — keyboard-operable and
                exposes its own expanded/collapsed state to assistive tech
                with zero extra ARIA wiring, no new dependency. */}
            {finding.evidenceSignals && finding.evidenceSignals.length > 0 && (
              <details className="group mt-2 border-t border-border pt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  Why was this detected?
                </summary>
                <div className="mt-2">
                  <FindingExplanationList finding={finding} />
                </div>
              </details>
            )}
          </div>
        ))}
      </div>

      {techniqueIds.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            ATT&CK Techniques
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {techniqueIds.map((techniqueId) => {
              const info = getTechniqueInfo(techniqueId);
              return (
                <button
                  key={techniqueId}
                  type="button"
                  onClick={() => goToTechnique(techniqueId)}
                  title={`Open ${techniqueId}${info ? ` — ${info.name}` : ""} in the MITRE ATT&CK page`}
                  aria-label={`Open technique ${techniqueId}${info ? `, ${info.name}` : ""} in the MITRE ATT&CK page`}
                  className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge
                    variant="outline"
                    className="cursor-pointer gap-1 font-mono text-[10px] transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {techniqueId}
                    {info && <span className="font-sans font-normal">— {info.name}</span>}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
