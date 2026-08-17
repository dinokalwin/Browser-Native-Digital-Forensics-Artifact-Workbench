/**
 * Phase 2 — Automated Test Foundation (SDD §24 item 1, chunk/record
 * resilience + zero-events diagnostic portion). `parseEVTXBuffer`'s own
 * value is its CONTROL FLOW — how it recovers from a throwing chunk
 * generator, a throwing record generator, an individual bad record, and
 * how it distinguishes "genuinely empty channel" from "every record
 * failed" in its zero-events diagnostics. Testing that control flow
 * requires simulating those exact conditions, which means mocking
 * `@ts-evtx/core`'s binary classes at the boundary rather than hand-
 * crafting real corrupted EVTX binary bytes (which the manual/exploratory
 * pass — SDD §24 item 7 — already covers against real files).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  xmlToEvent: vi.fn(),
}));

import { FileHeader } from "@ts-evtx/core/dist/src/evtx/FileHeader.js";
import { xmlToEvent } from "../record-mapper";
import { parseEVTXBuffer } from "../parser";

const VALID_BUFFER = new Uint8Array(4096);

/** Minimal manual iterator — mirrors the shape of the generators
 * `header.chunks()`/`chunk.records()` return (just `.next()`), so
 * `parser.ts`'s manually-driven iteration (not `for...of`) can be tested
 * exactly as written. `steps` may include a function that throws, to
 * simulate `.next()` itself failing mid-enumeration. */
function fakeIterator<T>(steps: Array<T | (() => T)>) {
  let i = 0;
  return {
    next: () => {
      if (i >= steps.length) return { done: true as const, value: undefined };
      const step = steps[i];
      i += 1;
      const value = typeof step === "function" ? (step as () => T)() : step;
      return { done: false as const, value };
    },
  };
}

function fakeRecord(opts: { verify?: () => boolean } = {}) {
  return { verify: opts.verify ?? (() => true) };
}

function fakeChunk(opts: {
  verify?: () => boolean;
  records?: () => ReturnType<typeof fakeIterator>;
}) {
  return {
    verify: opts.verify ?? (() => true),
    records: opts.records ?? (() => fakeIterator([])),
  };
}

function mockHeader(opts: {
  verify?: () => boolean;
  chunkCount?: number;
  chunks?: () => ReturnType<typeof fakeIterator>;
}) {
  vi.mocked(FileHeader).mockImplementation(
    () =>
      ({
        verify: opts.verify ?? (() => true),
        chunkCount: () => opts.chunkCount ?? 0,
        chunks: opts.chunks ?? (() => fakeIterator([])),
      }) as unknown as InstanceType<typeof FileHeader>,
  );
}

beforeEach(() => {
  vi.mocked(xmlToEvent).mockReset();
  vi.mocked(FileHeader).mockReset();
});

describe("parseEVTXBuffer", () => {
  it("rejects a buffer smaller than the minimum EVTX header size (truncated file)", async () => {
    await expect(parseEVTXBuffer(new Uint8Array(100))).rejects.toThrow(/too small/i);
  });

  it("rejects a file that fails header verification", async () => {
    mockHeader({ verify: () => false, chunkCount: 1 });
    await expect(parseEVTXBuffer(VALID_BUFFER)).rejects.toThrow(/header verification/i);
  });

  it("wraps an unexpected header-construction error in a generic message", async () => {
    vi.mocked(FileHeader).mockImplementation(() => {
      throw new Error("unexpected binary layout error");
    });
    await expect(parseEVTXBuffer(VALID_BUFFER)).rejects.toThrow(
      /doesn't look like a valid EVTX file/i,
    );
  });

  it("parses a valid chunk/record into an event and reports progress", async () => {
    vi.mocked(xmlToEvent).mockReturnValue({
      id: "evt-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventId: 4624,
      provider: "Test",
      computer: "HOST1",
      user: "user1",
      level: "Information",
      channel: "Security",
      message: "",
    });
    const chunk = fakeChunk({ records: () => fakeIterator([fakeRecord()]) });
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });

    const onProgress = vi.fn();
    const events = await parseEVTXBuffer(VALID_BUFFER, { onProgress });

    expect(events).toHaveLength(1);
    expect(onProgress).toHaveBeenCalledWith({
      chunksProcessed: 1,
      totalChunks: 1,
      eventsParsedSoFar: 1,
    });
  });

  it("recovers from an individual record's verify()/mapping throwing, and still processes the rest of the chunk", async () => {
    vi.mocked(xmlToEvent).mockReturnValue({
      id: "evt-ok",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventId: 4624,
      provider: "Test",
      computer: "HOST1",
      user: "user1",
      level: "Information",
      channel: "Security",
      message: "",
    });
    const badRecord = fakeRecord({
      verify: () => {
        throw new Error("corrupt record bounds");
      },
    });
    const goodRecord = fakeRecord();
    const chunk = fakeChunk({ records: () => fakeIterator([badRecord, goodRecord]) });
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });

    const events = await parseEVTXBuffer(VALID_BUFFER);
    expect(events).toHaveLength(1); // only the good record produced an event
  });

  it("recovers from the record generator itself throwing mid-chunk (stops that chunk, keeps prior chunks' events)", async () => {
    vi.mocked(xmlToEvent).mockReturnValue({
      id: "evt-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventId: 4624,
      provider: "Test",
      computer: "HOST1",
      user: "user1",
      level: "Information",
      channel: "Security",
      message: "",
    });
    const chunk1 = fakeChunk({ records: () => fakeIterator([fakeRecord()]) });
    const chunk2 = fakeChunk({
      records: () =>
        fakeIterator([
          fakeRecord(),
          () => {
            throw new Error("record enumeration failed");
          },
        ]),
    });
    mockHeader({ chunkCount: 2, chunks: () => fakeIterator([chunk1, chunk2]) });

    const events = await parseEVTXBuffer(VALID_BUFFER);
    // chunk1's 1 event + chunk2's 1 event (before its generator threw) = 2
    expect(events).toHaveLength(2);
  });

  it("recovers from the chunk generator itself throwing (keeps whatever was already parsed)", async () => {
    vi.mocked(xmlToEvent).mockReturnValue({
      id: "evt-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      eventId: 4624,
      provider: "Test",
      computer: "HOST1",
      user: "user1",
      level: "Information",
      channel: "Security",
      message: "",
    });
    const chunk1 = fakeChunk({ records: () => fakeIterator([fakeRecord()]) });
    mockHeader({
      chunkCount: 2,
      chunks: () =>
        fakeIterator([
          chunk1,
          () => {
            throw new Error("chunk enumeration failed");
          },
        ]),
    });

    const events = await parseEVTXBuffer(VALID_BUFFER);
    expect(events).toHaveLength(1);
  });

  it("throws immediately when the abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([]) });
    await expect(parseEVTXBuffer(VALID_BUFFER, { signal: controller.signal })).rejects.toThrow(
      /cancelled/i,
    );
  });

  it("zero-events diagnostic: throws when every chunk fails checksum verification", async () => {
    const chunk = fakeChunk({ verify: () => false });
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });
    await expect(parseEVTXBuffer(VALID_BUFFER)).rejects.toThrow(
      /every chunk failed checksum verification/i,
    );
  });

  it("zero-events diagnostic: throws when records exist but all fail record-level verification", async () => {
    const badRecord = fakeRecord({ verify: () => false });
    const chunk = fakeChunk({ records: () => fakeIterator([badRecord]) });
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });
    await expect(parseEVTXBuffer(VALID_BUFFER)).rejects.toThrow(
      /every record failed its own integrity check/i,
    );
  });

  it("zero-events diagnostic: throws when records verify but XML mapping fails for all of them", async () => {
    vi.mocked(xmlToEvent).mockReturnValue(null);
    const chunk = fakeChunk({ records: () => fakeIterator([fakeRecord()]) });
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });
    await expect(parseEVTXBuffer(VALID_BUFFER)).rejects.toThrow(/XML rendering\/mapping failed/i);
  });

  it("does NOT treat a genuinely empty channel (valid chunks, zero records attempted) as a parse failure", async () => {
    // chunksValid > 0 and recordsAttempted === 0 — many real Windows
    // channels (e.g. HardwareEvents) are legitimately empty; this must
    // return an empty array, not throw. See parser.ts's own doc comment
    // on this exact branch for the historical bug this guards against.
    const chunk = fakeChunk({ records: () => fakeIterator([]) });
    mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });
    const events = await parseEVTXBuffer(VALID_BUFFER);
    expect(events).toEqual([]);
  });

  // QA-03 — Bound Parser Error Logging
  describe("bounded record-error logging (QA-03)", () => {
    function badRecord(message: string) {
      return fakeRecord({
        verify: () => {
          throw new Error(message);
        },
      });
    }

    beforeEach(() => {
      // At least one good record survives in every case below — these
      // tests are about bounding *diagnostic output*, not re-testing the
      // "every record failed" zero-events diagnostic covered elsewhere.
      vi.mocked(xmlToEvent).mockReturnValue({
        id: "evt-ok",
        timestamp: "2026-01-01T00:00:00.000Z",
        eventId: 4624,
        provider: "Test",
        computer: "HOST1",
        user: "user1",
        level: "Information",
        channel: "Security",
        message: "",
      });
    });

    it("logs every record error individually when the count is at or below the cap (3)", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const records = [badRecord("e1"), badRecord("e2"), badRecord("e3"), fakeRecord()];
      const chunk = fakeChunk({ records: () => fakeIterator(records) });
      mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });

      await parseEVTXBuffer(VALID_BUFFER);

      // One "[EVTX PARSER ERROR]" line per bad record, no suppression summary.
      const parserErrorCalls = errorSpy.mock.calls.filter(
        (call) => call[0] === "[EVTX PARSER ERROR]",
      );
      expect(parserErrorCalls).toHaveLength(3);
      const suppressionCalls = errorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("suppressed"),
      );
      expect(suppressionCalls).toHaveLength(0);
      errorSpy.mockRestore();
    });

    it("caps detailed logging at 3 and emits exactly one summary line naming the suppressed count", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const records = [
        badRecord("e1"),
        badRecord("e2"),
        badRecord("e3"),
        badRecord("e4"),
        badRecord("e5"),
        fakeRecord(),
      ];
      const chunk = fakeChunk({ records: () => fakeIterator(records) });
      mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });

      await parseEVTXBuffer(VALID_BUFFER);

      const parserErrorCalls = errorSpy.mock.calls.filter(
        (call) => call[0] === "[EVTX PARSER ERROR]",
      );
      expect(parserErrorCalls).toHaveLength(3); // exactly the cap, not all 5

      const suppressionCalls = errorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("suppressed"),
      );
      expect(suppressionCalls).toHaveLength(1); // exactly one summary line
      expect(suppressionCalls[0][0]).toContain("Additional parser errors suppressed: 2"); // 5 - 3

      // Total console.error calls: 3 detailed + 1 summary, never unbounded.
      expect(errorSpy).toHaveBeenCalledTimes(4);
      errorSpy.mockRestore();
    });

    it("does not emit a summary line when nothing was suppressed", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const chunk = fakeChunk({ records: () => fakeIterator([badRecord("e1"), fakeRecord()]) });
      mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });

      await parseEVTXBuffer(VALID_BUFFER);

      const suppressionCalls = errorSpy.mock.calls.filter((call) =>
        String(call[0]).includes("suppressed"),
      );
      expect(suppressionCalls).toHaveLength(0);
      errorSpy.mockRestore();
    });

    it("still recovers every record exactly as before: valid records interspersed among more-than-cap corrupt ones all survive", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(xmlToEvent).mockImplementation(
        () =>
          ({
            id: `evt-${Math.random()}`,
            timestamp: "2026-01-01T00:00:00.000Z",
            eventId: 4624,
            provider: "Test",
            computer: "HOST1",
            user: "user1",
            level: "Information",
            channel: "Security",
            message: "",
          }) as import("@/types/evidence").EvtxEvent,
      );
      // 6 corrupt records (well above the cap of 3) interleaved with 4 good ones.
      const records = [
        badRecord("e1"),
        fakeRecord(),
        badRecord("e2"),
        fakeRecord(),
        badRecord("e3"),
        fakeRecord(),
        badRecord("e4"),
        badRecord("e5"),
        badRecord("e6"),
        fakeRecord(),
      ];
      const chunk = fakeChunk({ records: () => fakeIterator(records) });
      mockHeader({ chunkCount: 1, chunks: () => fakeIterator([chunk]) });

      const events = await parseEVTXBuffer(VALID_BUFFER);

      // Parsing resilience is unchanged: every good record still produced
      // an event, regardless of how many corrupt ones came before/after it.
      expect(events).toHaveLength(4);
      // And detailed logging is still bounded even with 6 corrupt records.
      const parserErrorCalls = errorSpy.mock.calls.filter(
        (call) => call[0] === "[EVTX PARSER ERROR]",
      );
      expect(parserErrorCalls).toHaveLength(3);
      errorSpy.mockRestore();
    });
  });
});
