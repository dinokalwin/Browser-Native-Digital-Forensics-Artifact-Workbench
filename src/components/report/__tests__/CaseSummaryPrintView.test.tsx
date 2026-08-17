// @vitest-environment jsdom
/**
 * Phase 5 Item 3 — Printable Case Summary. `CaseSummaryPrintView` is pure
 * and presentation-only (see its own doc comment) — these tests build
 * hand-crafted `InvestigationStatistics`/`InvestigationSummary`/
 * `DetectionFinding[]` fixtures directly (same "reuse existing test
 * utilities where they exist, hand-build minimal fixtures otherwise"
 * approach every other presentational-component test file in this
 * project uses — `IOCFindingsPanel`, `InvestigationSummaryPanel`, etc.
 * have no dedicated test files/fixtures of their own to reuse) rather
 * than parsing a real EVTX file, since nothing here depends on parser
 * behavior.
 */
import "@/test/a11y-setup";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { InvestigationStatistics } from "@/lib/statistics";
import type { DetectionFinding } from "@/lib/detection/types";
import type { InvestigationSummary, UploadedFileMeta } from "@/types/evidence";
import { CaseSummaryPrintView } from "../CaseSummaryPrintView";

const UPLOADED_FILE: UploadedFileMeta = {
  name: "security.evtx",
  sizeBytes: 2_500_000,
  uploadedAt: "2026-08-17T12:00:00.000Z",
};

const STATISTICS: InvestigationStatistics = {
  totalEvents: 1250,
  uniqueProviders: 6,
  uniqueComputers: 2,
  uniqueEventIds: 18,
  earliestTimestamp: new Date("2026-08-01T00:00:00.000Z"),
  latestTimestamp: new Date("2026-08-02T00:00:00.000Z"),
};

const EMPTY_STATISTICS: InvestigationStatistics = {
  totalEvents: 0,
  uniqueProviders: 0,
  uniqueComputers: 0,
  uniqueEventIds: 0,
  earliestTimestamp: null,
  latestTimestamp: null,
};

const SUMMARY: InvestigationSummary = {
  generatedAt: "2026-08-17T12:00:00.000Z",
  headline: "Suspicious brute-force activity detected",
  narrative: "Multiple failed logons were observed against a single account.",
  keyFindings: ["5 failed logons within 15 minutes", "USB storage device connected"],
  affectedHosts: ["WORKSTATION1"],
  timeRange: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-02T00:00:00.000Z" },
  riskScore: { score: 62, level: "high" },
};

function makeFinding(overrides: Partial<DetectionFinding> = {}): DetectionFinding {
  return {
    id: "ioc-brute-force-1",
    ruleId: "brute-force",
    ruleName: "Brute Force",
    eventId: "evt-1",
    title: "Possible brute-force logon attempts",
    description: "5 failed logons within 15 minutes.",
    severity: "critical",
    mitreTechnique: "T1110",
    recommendation: "Investigate the source of the failed logons.",
    ...overrides,
  };
}

describe("CaseSummaryPrintView", () => {
  it("renders with a valid, populated case", () => {
    render(
      <CaseSummaryPrintView
        uploadedFile={UPLOADED_FILE}
        statistics={STATISTICS}
        investigationSummary={SUMMARY}
        iocFindings={[makeFinding()]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "DFIR Workbench — Case Summary" }),
    ).toBeInTheDocument();
  });

  it("shows the correct case metadata", () => {
    render(
      <CaseSummaryPrintView
        uploadedFile={UPLOADED_FILE}
        statistics={STATISTICS}
        investigationSummary={SUMMARY}
        iocFindings={[]}
      />,
    );
    // "File name" appears twice (header + Case Information row) — scope to
    // the more specific match count rather than asserting singularity.
    expect(screen.getAllByText("security.evtx").length).toBeGreaterThan(0);
    expect(screen.getByText("1,250")).toBeInTheDocument(); // total events
    expect(screen.getByText("6")).toBeInTheDocument(); // unique providers
    expect(screen.getByText("2")).toBeInTheDocument(); // unique computers
    expect(screen.getByText("18")).toBeInTheDocument(); // unique event ids
  });

  it("shows detection/event counts and the severity breakdown from the existing findings, unmodified", () => {
    const findings = [
      makeFinding({ id: "1", severity: "critical" }),
      makeFinding({ id: "2", severity: "critical" }),
      makeFinding({ id: "3", severity: "warning" }),
      makeFinding({ id: "4", severity: "informational" }),
    ];
    render(
      <CaseSummaryPrintView
        uploadedFile={UPLOADED_FILE}
        statistics={STATISTICS}
        investigationSummary={SUMMARY}
        iocFindings={findings}
      />,
    );
    expect(screen.getByText("Detection Findings (4)")).toBeInTheDocument();
    expect(
      screen.getByText("2 critical · 1 warning · 1 informational", { exact: false }),
    ).toBeInTheDocument();
  });

  it("shows the existing threat score exactly as provided, without recalculating it", () => {
    render(
      <CaseSummaryPrintView
        uploadedFile={UPLOADED_FILE}
        statistics={STATISTICS}
        investigationSummary={SUMMARY}
        iocFindings={[]}
      />,
    );
    expect(screen.getByText("62/100 (high)", { exact: false })).toBeInTheDocument();
  });

  it("renders safely for an empty/minimal case (no events, no findings, no investigation summary)", () => {
    expect(() =>
      render(
        <CaseSummaryPrintView
          uploadedFile={UPLOADED_FILE}
          statistics={EMPTY_STATISTICS}
          investigationSummary={null}
          iocFindings={[]}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText("No suspicious findings detected for this case.")).toBeInTheDocument();
    expect(screen.getByText("Threat score not available for this case.")).toBeInTheDocument();
  });

  it("does not crash when optional investigation-summary metadata (affected hosts, key findings) is missing", () => {
    const minimalSummary: InvestigationSummary = {
      ...SUMMARY,
      affectedHosts: [],
      keyFindings: [],
    };
    expect(() =>
      render(
        <CaseSummaryPrintView
          uploadedFile={UPLOADED_FILE}
          statistics={STATISTICS}
          investigationSummary={minimalSummary}
          iocFindings={[]}
        />,
      ),
    ).not.toThrow();
    expect(screen.queryByText("Affected hosts:", { exact: false })).not.toBeInTheDocument();
  });

  it("collapses findings beyond the listed maximum into a '+N more' line, without dropping the total count", () => {
    const findings = Array.from({ length: 12 }, (_, i) =>
      makeFinding({ id: `f-${i}`, title: `Finding ${i}` }),
    );
    render(
      <CaseSummaryPrintView
        uploadedFile={UPLOADED_FILE}
        statistics={STATISTICS}
        investigationSummary={SUMMARY}
        iocFindings={findings}
      />,
    );
    expect(screen.getByText("Detection Findings (12)")).toBeInTheDocument();
    expect(
      screen.getByText("+4 additional findings — see the Evidence Viewer for the full list.", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });
});
