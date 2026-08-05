/**
 * MITRE ATT&CK Intelligence Dashboard — aggregation (Sprint 5.9.1).
 *
 * Pure, framework-free: no React, no recharts. Operates *only* on
 * `iocFindings`, the IOC Detection Engine's already-computed output
 * (`evidenceStore.iocFindings`, Phase 5.4) — this module never touches
 * `EvtxEvent[]` and never re-runs detection, per this sprint's "Use the
 * existing IOC findings. Do NOT rescan events." instruction. One pass over
 * `findings` (typically tens, not tens of thousands, of items) groups
 * everything the page needs; a second, small pass (bounded by the known
 * technique count, currently 13) turns those groups into the
 * ATT&CK-ordered tactic columns the Coverage Matrix renders.
 */
import type { DetectionFinding } from "@/lib/detection/types";
import { MITRE_TACTICS, getTechniqueInfo } from "./mapping";
import type { MitreAggregation, MitreTacticGroup, MitreTechniqueSummary } from "./types";

const SEVERITY_RANK: Record<DetectionFinding["severity"], number> = {
  critical: 3,
  warning: 2,
  informational: 1,
};

function emptySeverityCounts(): Record<DetectionFinding["severity"], number> {
  return { critical: 0, warning: 0, informational: 0 };
}

/**
 * Groups `findings` by MITRE technique (using each finding's already-
 * attached `mitreTechnique` field — never re-derived, never re-scanned),
 * then rolls those technique groups up into the 14 ATT&CK tactics.
 *
 * Never throws on an empty or entirely-unmapped finding set: zero
 * findings, or findings whose `mitreTechnique` is missing/unrecognized,
 * simply produce empty technique/tactic lists rather than a crash — the
 * same "never throw on missing data" contract every other `lib/*` module
 * in this project follows.
 */
export function aggregateMitreFindings(findings: readonly DetectionFinding[]): MitreAggregation {
  const byTechnique = new Map<string, DetectionFinding[]>();
  let unmappedFindingCount = 0;

  // Single pass over findings — the only O(n) scan this module performs.
  for (const finding of findings) {
    const techniqueId = finding.mitreTechnique;
    const info = techniqueId ? getTechniqueInfo(techniqueId) : undefined;
    if (!techniqueId || !info) {
      unmappedFindingCount += 1;
      continue;
    }
    const bucket = byTechnique.get(techniqueId);
    if (bucket) bucket.push(finding);
    else byTechnique.set(techniqueId, [finding]);
  }

  // Bounded by the number of distinct observed techniques (<= the known
  // technique count, currently 13) — not a second pass over `findings`.
  const techniques: MitreTechniqueSummary[] = Array.from(byTechnique.entries()).map(([id, techniqueFindings]) => {
    const info = getTechniqueInfo(id);
    // Guarded above (only mapped IDs are ever inserted into byTechnique),
    // but narrowed defensively rather than asserted, matching this
    // project's general avoidance of non-null assertions.
    const severityCounts = emptySeverityCounts();
    let highestSeverity: DetectionFinding["severity"] | null = null;
    let recommendation = "";

    for (const finding of techniqueFindings) {
      severityCounts[finding.severity] += 1;
      if (!highestSeverity || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[highestSeverity]) {
        highestSeverity = finding.severity;
        recommendation = finding.recommendation;
      }
    }

    return {
      id,
      name: info?.name ?? id,
      tactic: info?.tactic ?? "Discovery",
      description: info?.description ?? "",
      findings: techniqueFindings,
      findingCount: techniqueFindings.length,
      severityCounts,
      highestSeverity,
      recommendation,
    };
  });

  techniques.sort((a, b) => b.findingCount - a.findingCount);

  // Group the (small, already-deduped) techniques array by tactic — bounded
  // by technique count, not another pass over `findings`.
  const byTactic = new Map<string, MitreTechniqueSummary[]>();
  for (const technique of techniques) {
    const bucket = byTactic.get(technique.tactic);
    if (bucket) bucket.push(technique);
    else byTactic.set(technique.tactic, [technique]);
  }

  const tacticGroups: MitreTacticGroup[] = MITRE_TACTICS.map((tactic) => {
    const tacticTechniques = byTactic.get(tactic) ?? [];
    return {
      tactic,
      techniques: tacticTechniques,
      findingCount: tacticTechniques.reduce((sum, t) => sum + t.findingCount, 0),
    };
  });

  return {
    techniques,
    tacticGroups,
    totalFindings: findings.length,
    unmappedFindingCount,
  };
}
