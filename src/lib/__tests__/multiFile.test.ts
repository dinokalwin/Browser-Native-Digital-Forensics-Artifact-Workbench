/**
 * QA Remediation — QA-01 (Duplicate EVTX File Protection) and QA-02
 * (Same-Host Advisory) regression tests for `lib/multiFile.ts`'s two new
 * pure functions. Scoped to exactly these two exports — `mergeAndSortEvents`
 * / `synthesizeUploadedFileMeta` / `computePerFileStatistics` are unchanged
 * by this remediation and are exercised indirectly via `evidenceStore.test.ts`.
 */
import { describe, expect, it } from "vitest";
import type { EvtxEvent } from "@/types/evidence";
import { checkHostConsistency, dedupeFiles, type ParsedFileResult } from "../multiFile";

function makeFile(name: string, opts: { size?: number; lastModified?: number } = {}): File {
  const content = opts.size !== undefined ? "x".repeat(opts.size) : "dummy content";
  return new File([content], name, { lastModified: opts.lastModified ?? 1_700_000_000_000 });
}

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

function makeResult(fileName: string, events: EvtxEvent[]): ParsedFileResult {
  return {
    meta: { name: fileName, sizeBytes: 1024, uploadedAt: "2026-01-01T00:00:00.000Z" },
    events,
  };
}

describe("dedupeFiles — QA-01", () => {
  it("skips the same File object selected twice, keeping the first occurrence", () => {
    const file = makeFile("Security.evtx");
    const result = dedupeFiles([file, file]);

    expect(result.uniqueFiles).toEqual([file]);
    expect(result.duplicateFiles).toEqual(["Security.evtx"]);
  });

  it("treats two files with the same name but different size/lastModified as distinct, not duplicates", () => {
    const fileA = makeFile("Security.evtx", { size: 100, lastModified: 1 });
    const fileB = makeFile("Security.evtx", { size: 200, lastModified: 2 });

    const result = dedupeFiles([fileA, fileB]);

    expect(result.uniqueFiles).toEqual([fileA, fileB]);
    expect(result.duplicateFiles).toEqual([]);
  });

  it("keeps two genuinely different files (different names) untouched", () => {
    const fileA = makeFile("Security.evtx");
    const fileB = makeFile("System.evtx");

    const result = dedupeFiles([fileA, fileB]);

    expect(result.uniqueFiles).toEqual([fileA, fileB]);
    expect(result.duplicateFiles).toEqual([]);
  });

  it("flags every repeat when the same file is selected three or more times", () => {
    const file = makeFile("Security.evtx");
    const result = dedupeFiles([file, file, file]);

    expect(result.uniqueFiles).toEqual([file]);
    expect(result.duplicateFiles).toEqual(["Security.evtx", "Security.evtx"]);
  });

  it("never mutates the input array", () => {
    const files = [makeFile("Security.evtx"), makeFile("Security.evtx")];
    const original = [...files];
    dedupeFiles(files);
    expect(files).toEqual(original);
  });

  it("returns every file as unique when the batch has no duplicates at all", () => {
    const files = [makeFile("a.evtx"), makeFile("b.evtx"), makeFile("c.evtx")];
    const result = dedupeFiles(files);
    expect(result.uniqueFiles).toEqual(files);
    expect(result.duplicateFiles).toEqual([]);
  });
});

describe("checkHostConsistency — QA-02", () => {
  it("reports consistent when every file agrees on the same host", () => {
    const results = [
      makeResult("a.evtx", [makeEvent({ computer: "HOST1" })]),
      makeResult("b.evtx", [makeEvent({ computer: "HOST1" })]),
    ];
    const result = checkHostConsistency(results);
    expect(result.isConsistent).toBe(true);
    expect(result.hosts).toEqual(["HOST1"]);
  });

  it("reports inconsistent with the distinct host list when files disagree on host", () => {
    const results = [
      makeResult("a.evtx", [makeEvent({ computer: "HOST1" })]),
      makeResult("b.evtx", [makeEvent({ computer: "HOST2" })]),
    ];
    const result = checkHostConsistency(results);
    expect(result.isConsistent).toBe(false);
    expect(result.hosts).toEqual(["HOST1", "HOST2"]);
  });

  it('does not falsely flag a difference when one file\'s host is genuinely missing ("Unknown")', () => {
    const results = [
      makeResult("a.evtx", [makeEvent({ computer: "HOST1" })]),
      makeResult("b.evtx", [makeEvent({ computer: "Unknown" })]),
    ];
    const result = checkHostConsistency(results);
    expect(result.isConsistent).toBe(true);
    expect(result.hosts).toEqual(["HOST1"]);
  });

  it("reports consistent (with no warning) for a single loaded file, regardless of its host", () => {
    const results = [makeResult("a.evtx", [makeEvent({ computer: "HOST1" })])];
    const result = checkHostConsistency(results);
    expect(result.isConsistent).toBe(true);
    expect(result.hosts).toEqual([]);
  });

  it("reports consistent when no file has any known host at all", () => {
    const results = [
      makeResult("a.evtx", [makeEvent({ computer: "Unknown" })]),
      makeResult("b.evtx", [makeEvent({ computer: "Unknown" })]),
    ];
    const result = checkHostConsistency(results);
    expect(result.isConsistent).toBe(true);
    expect(result.hosts).toEqual([]);
  });
});
