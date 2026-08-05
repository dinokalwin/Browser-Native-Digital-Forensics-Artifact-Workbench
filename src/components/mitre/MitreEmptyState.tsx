import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/feedback/EmptyState";

/**
 * MITRE ATT&CK page's "nothing to show" state (Sprint 5.9.1, Step 11) — a
 * thin wrapper around the same dashboard-wide `EmptyState` component every
 * other empty/placeholder surface in the app already uses (see
 * CaseStateGate.tsx), fixing the icon/copy to this page's specific case:
 * a case is loaded, but the IOC Detection Engine flagged zero findings, so
 * there is nothing to map to MITRE ATT&CK. Distinct from `CaseStateGate`'s
 * own "no case loaded" empty state, which this page still uses first (see
 * MitreAttackPage.tsx) — this one only renders once a case IS loaded.
 */
export function MitreEmptyState() {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="No MITRE ATT&CK techniques detected."
      description="The IOC Detection Engine didn't flag any findings for this case, so there are no techniques to map."
    />
  );
}
