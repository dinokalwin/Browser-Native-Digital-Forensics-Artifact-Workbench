/**
 * Browser-native EVTX parser — public entry point.
 *
 * As of this integration, parsing runs inside a dedicated Web Worker
 * (src/backend/engine/parser.worker.ts) rather than on the main thread,
 * so the UI stays fully responsive for the entire duration of a parse,
 * including large files. The worker is spawned lazily on first use and
 * reused across subsequent files.
 *
 * The exported signature is unchanged from the previous main-thread-only
 * implementation (`parseEVTX(file): Promise<EvtxEvent[]>`), so
 * src/backend/index.ts and everything above it (evidenceStore, UI) needed
 * no changes for this swap.
 *
 * See src/backend/engine/ for the actual parsing core:
 *  - parser.ts         — validation + resilient chunk/record walking
 *  - record-mapper.ts  — XML -> EvtxEvent, including the corrupt-timestamp
 *                         handling fix (never fabricates a fake date)
 *  - parser.worker.ts  — Worker entry point (thin message-routing shim
 *                         around parser.ts)
 *  - worker-client.ts  — lifecycle: spawn/reuse/timeout/cancel/terminate
 */
import type { EvtxEvent } from "@/types/evidence";
import { parseInWorker, disposeParserWorker } from "./engine/worker-client";

// Note: file-size validation (MIN_FILE_SIZE) lives in engine/parser.ts,
// which every parse path — this file's parseEVTX() included — routes
// through via the worker. A duplicate pre-worker check used to live here
// too (Phase 1 removed it, along with the unused parseEVTXBuffer() export
// it belonged to — nothing in src imported it; the worker imports its own
// parseEVTXBuffer from ./engine/parser, not this file). See
// docs/CHANGELOG.md and docs/ARCHITECTURE_DECISIONS.md.

/** Reads a browser File and parses it as EVTX. See src/backend/engine/ for the parsing core. */
export async function parseEVTX(file: File): Promise<EvtxEvent[]> {
  const arrayBuffer = await file.arrayBuffer();
  return parseInWorker(arrayBuffer);
}

/**
 * Terminates the parser worker and frees everything it holds (including
 * any parsed-buffer memory still resident in the worker thread). Not
 * currently wired to any UI lifecycle hook — call this from wherever the
 * app knows no further EVTX parsing is expected soon (e.g. on the
 * evidence workbench view's unmount), or leave unused; the worker is
 * lightweight and safe to leave warm for the session.
 */
export { disposeParserWorker };
