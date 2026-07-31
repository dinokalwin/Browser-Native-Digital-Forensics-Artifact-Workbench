/**
 * Rule-based investigation summary generation. Composes a short,
 * human-readable narrative from the parsed events and the suspicious
 * findings already computed by `detectSuspiciousEvents` — no external
 * calls, no LLM, entirely deterministic and client-side.
 */
import type { EvtxEvent, InvestigationSummary, SuspiciousFinding } from "@/types/evidence";
import { computeRiskScore } from "@/backend/risk-score";

function formatRange(events: EvtxEvent[]): { start: string; end: string } {
  const timestamps = events.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  return {
    start: new Date(timestamps[0]).toISOString(),
    end: new Date(timestamps[timestamps.length - 1]).toISOString(),
  };
}

export async function generateSummary(
  events: EvtxEvent[],
  suspiciousFindings: SuspiciousFinding[],
): Promise<InvestigationSummary> {
  const affectedHosts = Array.from(new Set(events.map((e) => e.computer))).sort();
  const timeRange =
    events.length > 0
      ? formatRange(events)
      : { start: new Date().toISOString(), end: new Date().toISOString() };

  const riskScore = computeRiskScore(suspiciousFindings);
  const criticalCount = suspiciousFindings.filter((f) => f.severity === "critical").length;
  const warningCount = suspiciousFindings.filter((f) => f.severity === "warning").length;

  const headline =
    suspiciousFindings.length === 0
      ? `${events.length.toLocaleString()} events analyzed across ${affectedHosts.length} host${affectedHosts.length === 1 ? "" : "s"} — no suspicious indicators identified.`
      : `${events.length.toLocaleString()} events analyzed across ${affectedHosts.length} host${affectedHosts.length === 1 ? "" : "s"} — ${suspiciousFindings.length} suspicious indicator${suspiciousFindings.length === 1 ? "" : "s"} identified (${criticalCount} critical, ${warningCount} warning).`;

  const narrativeParts: string[] = [];
  narrativeParts.push(
    `This case covers ${events.length.toLocaleString()} events spanning ${timeRange.start} to ${timeRange.end}, across ${affectedHosts.length} host${affectedHosts.length === 1 ? "" : "s"} (${affectedHosts.slice(0, 5).join(", ")}${affectedHosts.length > 5 ? ", …" : ""}).`,
  );
  if (suspiciousFindings.length === 0) {
    narrativeParts.push(
      "The rule-based detector did not flag any known suspicious patterns (brute-force logons, cleared audit logs, new privileged accounts, suspicious PowerShell, Defender detections, or new services). This does not rule out compromise — it means none of the current heuristics matched.",
    );
  } else {
    narrativeParts.push(
      `The rule-based detector flagged ${suspiciousFindings.length} event${suspiciousFindings.length === 1 ? "" : "s"} as suspicious, driving an overall risk score of ${riskScore.score}/100 (${riskScore.level}). Review the Suspicious Events panel for details on each finding.`,
    );
  }

  const keyFindings =
    suspiciousFindings.length > 0
      ? suspiciousFindings.slice(0, 5).map((f) => f.title)
      : [
          `${events.length.toLocaleString()} total events parsed`,
          `${affectedHosts.length} distinct host${affectedHosts.length === 1 ? "" : "s"} observed`,
        ];

  return {
    generatedAt: new Date().toISOString(),
    headline,
    narrative: narrativeParts.join(" "),
    keyFindings,
    affectedHosts,
    timeRange,
    riskScore,
  };
}
