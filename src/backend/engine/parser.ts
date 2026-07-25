/**
 * Core EVTX parsing logic — validates, walks chunks/records, and maps
 * each record to an EvtxEvent. Runs either on the main thread (called
 * directly) or inside parser.worker.ts; contains no thread-specific code
 * itself, so both callers share one implementation.
 *
 * Deep-imports only the pure binary/XML parsing classes from
 * `@ts-evtx/core` (matching the existing project convention — see the
 * original evtx-parser.ts) rather than the package's top-level barrel,
 * which also re-exports `EvtxFile`/a query builder/`parseResolvedEvents`.
 * Those pull in Node's `fs` and an optional `@ts-evtx/messages` companion
 * package (native SQLite binding) that this project never installs —
 * neither is reachable from a deep import of just BinaryReader/FileHeader,
 * so no Vite alias/stub is needed for them. The one remaining browser
 * incompatibility in the *used* code path — `logging/logger.js` reading
 * `process.env.EVTX_DEBUG` at module scope — is fixed precisely via
 * vite.config.ts's `define` entry (and belt-and-suspenders via
 * patches/@ts-evtx+core+1.2.0.patch), both already present in this repo.
 */
import { BinaryReader } from "@ts-evtx/core/dist/src/binary/BinaryReader.js";
import { FileHeader } from "@ts-evtx/core/dist/src/evtx/FileHeader.js";
import { InvalidRecordException } from "@ts-evtx/core/dist/src/evtx/Record.js";

import type { EvtxEvent } from "@/types/evidence";
import { xmlToEvent } from "./record-mapper";

const MIN_FILE_SIZE = 4096; // EVTX file header size

export interface EngineParseProgress {
  chunksProcessed: number;
  totalChunks: number;
  eventsParsedSoFar: number;
}

export interface EngineParseOptions {
  onProgress?: (progress: EngineParseProgress) => void;
  signal?: AbortSignal;
  /** How many records to process before yielding to the event loop. Default: 500. */
  yieldEveryNRecords?: number;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Parsing was cancelled.", "AbortError");
}

/**
 * Parses a raw EVTX file buffer into structured events.
 *
 * Resilience: uses the manually-driven iterator protocol (not `for...of`)
 * for both chunk and record enumeration. This matters because
 * `@ts-evtx/core`'s `records()` generator re-throws non-
 * `InvalidRecordException` errors (e.g. a raw bounds-check failure from a
 * truncated/adversarial chunk) *during iterator advancement* — a
 * `for...of` loop has no way to catch an error thrown by its own
 * `next()` call and continue, so the exception would propagate straight
 * out and abort every remaining chunk in the file. Driving `.next()`
 * ourselves inside try/catch means one unrecoverable record or chunk only
 * ends iteration of *that* chunk, never the whole parse — important
 * because dirty/partially-overwritten EVTX files are the norm in
 * real-world forensic acquisitions, not the exception.
 */
export async function parseEVTXBuffer(
  buffer: Uint8Array,
  options: EngineParseOptions = {},
): Promise<EvtxEvent[]> {
  const yieldEvery = options.yieldEveryNRecords ?? 500;
  throwIfAborted(options.signal);

  if (buffer.byteLength < MIN_FILE_SIZE) {
    throw new Error("This file is too small to be a valid EVTX file.");
  }

  let header: InstanceType<typeof FileHeader>;
  try {
    header = new FileHeader(new BinaryReader(buffer), 0);
    if (!header.verify()) {
      throw new Error(
        "This file failed EVTX header verification. It may be corrupted, truncated, or not a genuine .evtx file.",
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("header verification")) throw err;
    throw new Error("Unable to read this file — it doesn't look like a valid EVTX file.");
  }

  const events: EvtxEvent[] = [];
  const totalChunks = header.chunkCount();
  let chunksProcessed = 0;
  let chunksValid = 0;
  let recordsAttempted = 0;
  let recordsVerifiedOk = 0;
  let recordsMappedOk = 0;
  let recordsSinceYield = 0;

  // includeInactive=true: a not-cleanly-closed file may have chunks the
  // writer had allocated but not marked fully active. For a forensics
  // tool we want maximum recovery, not the strict "only committed
  // chunks" view a live log reader would use.
  const chunkGenerator = header.chunks(true);

  for (;;) {
    throwIfAborted(options.signal);

    let chunkStep;
    try {
      chunkStep = chunkGenerator.next();
    } catch {
      break; // Chunk enumeration itself failed — recover whatever we already parsed.
    }
    if (chunkStep.done) break;
    const chunk = chunkStep.value;

    let chunkValid: boolean;
    try {
      chunkValid = chunk.verify();
    } catch {
      chunkValid = false;
    }
    if (chunkValid) chunksValid++;

    if (chunkValid) {
      let recordGenerator: ReturnType<typeof chunk.records> | null = null;
      try {
        recordGenerator = chunk.records();
      } catch {
        recordGenerator = null;
      }

      if (recordGenerator) {
        for (;;) {
          let recordStep;
          try {
            recordStep = recordGenerator.next();
          } catch {
            break; // Record enumeration stopped early for this chunk — keep what we have.
          }
          if (recordStep.done) break;
          const record = recordStep.value;
          recordsAttempted++;

          try {
            if (record.verify()) {
              recordsVerifiedOk++;
              const event = xmlToEvent(record);
              if (event) {
                recordsMappedOk++;
                events.push(event);
              }
            }
          } catch (err) {
            // A single malformed record (bad BXML token, unresolved
            // template, truncated substitution array — InvalidRecordException
            // — or any other mapping failure) must never abort the parse.
            void (err instanceof InvalidRecordException); // documents the expected error type; no special handling needed beyond "skip and continue"
          }

          recordsSinceYield++;
          if (recordsSinceYield >= yieldEvery) {
            recordsSinceYield = 0;
            await yieldToMain();
            throwIfAborted(options.signal);
          }
        }
      }
    }

    chunksProcessed++;
    options.onProgress?.({ chunksProcessed, totalChunks, eventsParsedSoFar: events.length });
  }

  if (events.length === 0 && totalChunks > 0) {
    throw new Error(
      `No events could be extracted from this file. Diagnostics: ${chunksProcessed} chunk(s) walked, ${chunksValid} passed checksum verification, ${recordsAttempted} record(s) attempted, ${recordsVerifiedOk} passed record verification, ${recordsMappedOk} produced a usable event. ` +
        (chunksValid === 0
          ? "Every chunk failed checksum verification — the file may be truncated, use an unsupported EVTX variant, or not be a genuine .evtx file."
          : recordsVerifiedOk === 0
            ? "Chunks verified, but every record failed its own integrity check — the file's internal record structure may be corrupted or unsupported."
            : "Records verified, but XML rendering/mapping failed for all of them — this may indicate a BinXML template variant this parser doesn't yet support."),
    );
  }

  return events;
}
