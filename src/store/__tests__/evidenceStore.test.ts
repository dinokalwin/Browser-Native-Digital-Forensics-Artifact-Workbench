/**
 * Phase 2 — Automated Test Foundation (SDD §24 item 4): `evidenceStore
 * .loadFiles`'s branching, independent of any UI. `@/services/evtxApi` is
 * mocked wholesale so these tests exercise only the store's own
 * orchestration logic (parse success/partial-fail/all-fail,
 * detection/summary failure isolation) — not the real parser or detection
 * engine, which have their own dedicated test suites.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvtxEvent, InvestigationSummary } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";

vi.mock("@/services/evtxApi", () => ({
  parseEVTX: vi.fn(),
  detectIOCs: vi.fn(),
  adaptToSuspiciousFindings: vi.fn(),
  generateInvestigationSummary: vi.fn(),
}));

import {
  parseEVTX,
  detectIOCs,
  adaptToSuspiciousFindings,
  generateInvestigationSummary,
} from "@/services/evtxApi";
import { useEvidenceStore } from "../evidenceStore";

function makeEvent(overrides: Partial<EvtxEvent> = {}): EvtxEvent {
  return {
    id: "evt-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    eventId: 4624,
    provider: "Test",
    computer: "HOST1",
    user: "user1",
    level: "Information",
    channel: "Security",
    message: "",
    ...overrides,
  };
}

function makeFinding(overrides: Partial<DetectionFinding> = {}): DetectionFinding {
  return {
    id: "ioc-1",
    ruleId: "test-rule",
    ruleName: "Test Rule",
    eventId: "evt-1",
    title: "Test finding",
    description: "",
    severity: "warning",
    recommendation: "",
    ...overrides,
  };
}

function makeFile(name: string, opts: { size?: number; lastModified?: number } = {}): File {
  const content = opts.size !== undefined ? "x".repeat(opts.size) : "dummy content";
  return new File([content], name, { lastModified: opts.lastModified ?? 1_700_000_000_000 });
}

const SUMMARY: InvestigationSummary = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  headline: "Headline",
  narrative: "Narrative",
  keyFindings: [],
  affectedHosts: [],
  timeRange: { start: "2026-01-01T00:00:00.000Z", end: "2026-01-01T00:00:00.000Z" },
  riskScore: { score: 0, level: "low" },
};

beforeEach(() => {
  useEvidenceStore.getState().reset();
  vi.mocked(parseEVTX).mockReset();
  vi.mocked(detectIOCs).mockReset();
  vi.mocked(adaptToSuspiciousFindings).mockReset();
  vi.mocked(generateInvestigationSummary).mockReset();
  // Sensible defaults every test can override.
  vi.mocked(detectIOCs).mockReturnValue([]);
  vi.mocked(adaptToSuspiciousFindings).mockReturnValue([]);
  vi.mocked(generateInvestigationSummary).mockResolvedValue(SUMMARY);
});

describe("evidenceStore.loadFiles", () => {
  it("on full success: parses, detects, summarizes, and reaches status 'ready'", async () => {
    const event = makeEvent();
    vi.mocked(parseEVTX).mockResolvedValue([event]);
    const finding = makeFinding({ eventId: event.id });
    vi.mocked(detectIOCs).mockReturnValue([finding]);
    vi.mocked(adaptToSuspiciousFindings).mockReturnValue([
      {
        id: finding.id,
        eventId: finding.eventId,
        title: finding.title,
        description: "",
        severity: "warning",
      },
    ]);

    await useEvidenceStore.getState().loadFiles([makeFile("System.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.events).toHaveLength(1);
    expect(state.failedFiles).toEqual([]);
    expect(state.iocFindings).toEqual([finding]);
    expect(state.iocFindingsByEvent[event.id]).toEqual([finding]);
    expect(state.suspiciousFindings).toHaveLength(1);
    expect(state.investigationSummary).toEqual(SUMMARY);
    expect(state.error).toBeNull();
  });

  it("on single-file parse failure: reaches status 'error' with a single-file message", async () => {
    vi.mocked(parseEVTX).mockRejectedValue(new Error("corrupt file"));

    await useEvidenceStore.getState().loadFiles([makeFile("bad.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("error");
    expect(state.error).toBe("Failed to parse the uploaded file.");
    expect(state.failedFiles).toEqual(["bad.evtx"]);
    expect(state.events).toEqual([]);
  });

  it("on multi-file partial failure: one bad file doesn't abort the others, and 'ready' is still reached", async () => {
    vi.mocked(parseEVTX).mockImplementation(async (file: File) => {
      if (file.name === "bad.evtx") throw new Error("corrupt");
      return [makeEvent({ id: `evt-${file.name}` })];
    });

    await useEvidenceStore.getState().loadFiles([makeFile("good.evtx"), makeFile("bad.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.failedFiles).toEqual(["bad.evtx"]);
    expect(state.events).toHaveLength(1);
    expect(state.uploadedFiles.map((f) => f.name)).toEqual(["good.evtx"]);
  });

  it("on multi-file total failure: reaches status 'error' with a multi-file message naming the count", async () => {
    vi.mocked(parseEVTX).mockRejectedValue(new Error("corrupt"));

    await useEvidenceStore.getState().loadFiles([makeFile("a.evtx"), makeFile("b.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("error");
    expect(state.error).toBe("Failed to parse all 2 uploaded files.");
    expect(state.failedFiles).toEqual(["a.evtx", "b.evtx"]);
  });

  it("isolates a detection-engine failure: parse still succeeds and reaches 'ready', with empty findings/summary", async () => {
    vi.mocked(parseEVTX).mockResolvedValue([makeEvent()]);
    vi.mocked(detectIOCs).mockImplementation(() => {
      throw new Error("rule engine bug");
    });

    await useEvidenceStore.getState().loadFiles([makeFile("System.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.events).toHaveLength(1); // the successful parse is preserved
    expect(state.iocFindings).toEqual([]);
    expect(state.iocFindingsByEvent).toEqual({});
    expect(state.suspiciousFindings).toEqual([]);
    expect(state.investigationSummary).toBeNull();
  });

  it("isolates a summary-generation failure occurring AFTER detection already succeeded: the already-computed findings are preserved, only the summary is lost", async () => {
    const event = makeEvent();
    vi.mocked(parseEVTX).mockResolvedValue([event]);
    const finding = makeFinding({ eventId: event.id });
    vi.mocked(detectIOCs).mockReturnValue([finding]);
    vi.mocked(adaptToSuspiciousFindings).mockReturnValue([
      {
        id: finding.id,
        eventId: finding.eventId,
        title: finding.title,
        description: "",
        severity: "warning",
      },
    ]);
    vi.mocked(generateInvestigationSummary).mockRejectedValue(new Error("summary generation bug"));

    await useEvidenceStore.getState().loadFiles([makeFile("System.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.iocFindings).toEqual([finding]); // computed before the failure, not rolled back
    expect(state.suspiciousFindings).toHaveLength(1);
    expect(state.investigationSummary).toBeNull(); // never assigned, since generateInvestigationSummary rejected
  });

  it("loadFile (single-file entry point) delegates to loadFiles([file]) with identical behavior", async () => {
    vi.mocked(parseEVTX).mockResolvedValue([makeEvent()]);

    await useEvidenceStore.getState().loadFile(makeFile("System.evtx"));
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.events).toHaveLength(1);
  });

  it("reset() returns the store to its initial idle state", async () => {
    vi.mocked(parseEVTX).mockResolvedValue([makeEvent()]);
    await useEvidenceStore.getState().loadFiles([makeFile("System.evtx")]);
    expect(useEvidenceStore.getState().status).toBe("ready");

    useEvidenceStore.getState().reset();
    const state = useEvidenceStore.getState();
    expect(state.status).toBe("idle");
    expect(state.events).toEqual([]);
    expect(state.uploadedFile).toBeNull();
  });

  // QA-01 — Duplicate EVTX File Protection
  it("QA-01: a duplicate file (same identity) is never parsed and never merged as a second evidence source", async () => {
    vi.mocked(parseEVTX).mockResolvedValue([makeEvent()]);
    const file = makeFile("Security.evtx", { size: 100, lastModified: 5 });

    await useEvidenceStore.getState().loadFiles([file, file]);
    const state = useEvidenceStore.getState();

    expect(parseEVTX).toHaveBeenCalledTimes(1); // never parsed twice
    expect(state.duplicateFiles).toEqual(["Security.evtx"]);
    expect(state.uploadedFiles).toHaveLength(1); // not merged as a second source
  });

  it("QA-01: a duplicate file doesn't inflate event counts or create duplicate findings", async () => {
    const event = makeEvent();
    vi.mocked(parseEVTX).mockResolvedValue([event]);
    const finding = makeFinding({ eventId: event.id });
    vi.mocked(detectIOCs).mockReturnValue([finding]);
    const file = makeFile("Security.evtx", { size: 100, lastModified: 5 });

    await useEvidenceStore.getState().loadFiles([file, file]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.events).toHaveLength(1);
    expect(state.iocFindings).toEqual([finding]);
  });

  it("QA-01: existing single-file loading is unaffected — duplicateFiles is empty", async () => {
    vi.mocked(parseEVTX).mockResolvedValue([makeEvent()]);

    await useEvidenceStore.getState().loadFiles([makeFile("System.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready");
    expect(state.duplicateFiles).toEqual([]);
  });

  it("QA-01: two distinct files with the same name (different size/lastModified) are both parsed, not treated as duplicates", async () => {
    vi.mocked(parseEVTX).mockImplementation(async (file: File) => [
      makeEvent({ id: `evt-${file.size}` }),
    ]);
    const fileA = makeFile("Security.evtx", { size: 100, lastModified: 1 });
    const fileB = makeFile("Security.evtx", { size: 200, lastModified: 2 });

    await useEvidenceStore.getState().loadFiles([fileA, fileB]);
    const state = useEvidenceStore.getState();

    expect(parseEVTX).toHaveBeenCalledTimes(2);
    expect(state.duplicateFiles).toEqual([]);
    expect(state.uploadedFiles).toHaveLength(2);
  });

  // QA-02 — Same-Host Advisory
  it("QA-02: files sharing the same host produce no warning", async () => {
    vi.mocked(parseEVTX).mockImplementation(async () => [makeEvent({ computer: "HOST1" })]);

    await useEvidenceStore
      .getState()
      .loadFiles([makeFile("a.evtx"), makeFile("b.evtx", { lastModified: 2 })]);
    const state = useEvidenceStore.getState();

    expect(state.multiHostWarning).toBeNull();
  });

  it("QA-02: files with clearly different hosts set a warning naming the hosts, but still reach 'ready' so the analyst can continue", async () => {
    vi.mocked(parseEVTX).mockImplementation(async (file: File) => [
      makeEvent({ computer: file.name === "a.evtx" ? "HOST1" : "HOST2" }),
    ]);

    await useEvidenceStore
      .getState()
      .loadFiles([makeFile("a.evtx"), makeFile("b.evtx", { lastModified: 2 })]);
    const state = useEvidenceStore.getState();

    expect(state.status).toBe("ready"); // advisory only — never blocks the load
    expect(state.multiHostWarning).toEqual(["HOST1", "HOST2"]);
    expect(state.events).toHaveLength(2); // data isn't dropped or blocked
  });

  it("QA-02: a single-file load never sets a warning", async () => {
    vi.mocked(parseEVTX).mockResolvedValue([makeEvent({ computer: "HOST1" })]);

    await useEvidenceStore.getState().loadFiles([makeFile("System.evtx")]);
    const state = useEvidenceStore.getState();

    expect(state.multiHostWarning).toBeNull();
  });

  it("QA-02: missing host info on one file is not falsely reported as a host mismatch", async () => {
    vi.mocked(parseEVTX).mockImplementation(async (file: File) => [
      makeEvent({ computer: file.name === "a.evtx" ? "HOST1" : "Unknown" }),
    ]);

    await useEvidenceStore
      .getState()
      .loadFiles([makeFile("a.evtx"), makeFile("b.evtx", { lastModified: 2 })]);
    const state = useEvidenceStore.getState();

    expect(state.multiHostWarning).toBeNull();
  });

  it("QA-02: existing same-host multi-file correlation behavior is unchanged — findings still computed across the merged set", async () => {
    vi.mocked(parseEVTX).mockImplementation(async () => [makeEvent({ computer: "HOST1" })]);
    const finding = makeFinding();
    vi.mocked(detectIOCs).mockReturnValue([finding]);

    await useEvidenceStore
      .getState()
      .loadFiles([makeFile("a.evtx"), makeFile("b.evtx", { lastModified: 2 })]);
    const state = useEvidenceStore.getState();

    expect(state.multiHostWarning).toBeNull();
    expect(state.status).toBe("ready");
    expect(state.iocFindings).toEqual([finding]);
    expect(state.events).toHaveLength(2);
  });
});
