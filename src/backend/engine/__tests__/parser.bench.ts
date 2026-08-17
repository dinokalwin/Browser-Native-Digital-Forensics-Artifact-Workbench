/**
 * Phase 4 — Performance at Scale (SDD §25 Phase 10 gate: "a defined
 * large-file benchmark (event count, parse time, main-thread
 * responsiveness) with measured results, not just a 'feels fast' check").
 *
 * Benchmarks `parseEVTXBuffer`'s OWN loop/yield/resilience control flow —
 * the code this project actually owns and can modify — at synthetic
 * record counts representative of "tens of thousands" and "100k+" events
 * (SDD §7, §20). It deliberately does NOT benchmark `@ts-evtx/core`'s
 * vendored binary/BinXML decoder: that's third-party code this project's
 * rules forbid rewriting, and there is no deterministic multi-hundred-MB
 * real EVTX fixture that can be committed to this repo. See this phase's
 * report for the full scoping rationale.
 *
 * Uses the exact same mock boundary as `parser.test.ts` (Phase 2) — mocking
 * `@ts-evtx/core`'s `BinaryReader`/`FileHeader` and this project's own
 * `record-mapper.ts#xmlToEvent` — so what's measured is the real,
 * unmodified `parseEVTXBuffer` implementation, not a simplified stand-in.
 * `yieldEveryNRecords` is left at its real default (500), so the elapsed
 * time below already includes the actual `await yieldToMain()` calls that
 * keep the main thread responsive during a real parse (SDD §20).
 *
 * Run via `npm run bench` (`vitest bench`). Vitest's benchmark runner uses
 * a separate file-matching pattern (`*.bench.ts`) from `test.include` in
 * vitest.config.ts, so this file is never picked up by `npm run test` and
 * has zero effect on the 185-test baseline.
 */
import { bench, describe, vi } from "vitest";

vi.mock("@ts-evtx/core/dist/src/binary/BinaryReader.js", () => ({
  BinaryReader: vi.fn(),
}));
vi.mock("@ts-evtx/core/dist/src/evtx/FileHeader.js", () => ({
  FileHeader: vi.fn(),
}));
vi.mock("@ts-evtx/core/dist/src/evtx/Record.js", () => ({
  InvalidRecordException: class InvalidRecordException extends Error {},
}));
vi.mock("../record-mapper", () => ({
  xmlToEvent: vi.fn(() => ({
    id: "evt-bench",
    timestamp: "2026-01-01T00:00:00.000Z",
    eventId: 4624,
    provider: "Microsoft-Windows-Security-Auditing",
    computer: "WORKSTATION1",
    user: "jsmith",
    level: "Information",
    channel: "Security",
    message: "TargetUserName: jsmith | LogonType: 10",
  })),
}));

import { FileHeader } from "@ts-evtx/core/dist/src/evtx/FileHeader.js";
import { parseEVTXBuffer } from "../parser";

const VALID_BUFFER = new Uint8Array(4096);

/**
 * Lazily-generated record iterator — mirrors the `.next()`-only shape
 * `chunk.records()` returns (same as `parser.test.ts`'s `fakeIterator`),
 * but never materializes a `count`-length array up front. That matters at
 * bench scale: a 100,000-record run shouldn't itself pay for allocating a
 * 100,000-element JS array before `parseEVTXBuffer` even starts iterating.
 */
function lazyRecordIterator(count: number) {
  let produced = 0;
  return {
    next: () => {
      if (produced >= count) return { done: true as const, value: undefined };
      produced += 1;
      return { done: false as const, value: { verify: () => true } };
    },
  };
}

/** Spreads `recordCount` synthetic records evenly across `chunkCount` chunks. */
function mockHeaderWithRecords(recordCount: number, chunkCount: number): void {
  const perChunk = Math.ceil(recordCount / chunkCount);
  let chunksYielded = 0;
  vi.mocked(FileHeader).mockImplementation(
    () =>
      ({
        verify: () => true,
        chunkCount: () => chunkCount,
        chunks: () => ({
          next: () => {
            if (chunksYielded >= chunkCount) return { done: true as const, value: undefined };
            chunksYielded += 1;
            return {
              done: false as const,
              value: {
                verify: () => true,
                records: () => lazyRecordIterator(perChunk),
              },
            };
          },
        }),
      }) as unknown as InstanceType<typeof FileHeader>,
  );
}

describe("parseEVTXBuffer throughput (synthetic records, mocked binary/XML boundary)", () => {
  bench("10,000 records / 5 chunks", async () => {
    mockHeaderWithRecords(10_000, 5);
    await parseEVTXBuffer(VALID_BUFFER);
  });

  bench("100,000 records / 20 chunks", async () => {
    mockHeaderWithRecords(100_000, 20);
    await parseEVTXBuffer(VALID_BUFFER);
  });
});
