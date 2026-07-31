/// <reference lib="webworker" />
/**
 * Dedicated Worker entry point for EVTX parsing. Keeps the main thread —
 * and therefore the UI — fully responsive during a parse, including for
 * large files. Contains no parsing logic itself; it's a thin
 * message-routing shim around parser.ts, so main-thread and worker-thread
 * parsing (if ever called directly) can never drift apart.
 */
import { parseEVTXBuffer } from "./parser";
import type { EvtxEvent } from "@/types/evidence";

interface WorkerParseRequest {
  type: "PARSE";
  id: string;
  buffer: ArrayBuffer;
}
interface WorkerCancelRequest {
  type: "CANCEL";
  id: string;
}
type WorkerRequest = WorkerParseRequest | WorkerCancelRequest;

type WorkerResponse =
  | {
      type: "PROGRESS";
      id: string;
      chunksProcessed: number;
      totalChunks: number;
      eventsParsedSoFar: number;
    }
  | { type: "RESULT"; id: string; events: EvtxEvent[] }
  | { type: "ERROR"; id: string; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const activeControllers = new Map<string, AbortController>();

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "CANCEL") {
    activeControllers.get(message.id)?.abort();
    return;
  }

  void handleParse(message.id, message.buffer);
});

async function handleParse(id: string, buffer: ArrayBuffer): Promise<void> {
  const controller = new AbortController();
  activeControllers.set(id, controller);

  try {
    const events = await parseEVTXBuffer(new Uint8Array(buffer), {
      signal: controller.signal,
      onProgress: (p) =>
        post({
          type: "PROGRESS",
          id,
          chunksProcessed: p.chunksProcessed,
          totalChunks: p.totalChunks,
          eventsParsedSoFar: p.eventsParsedSoFar,
        }),
    });
    post({ type: "RESULT", id, events });
  } catch (err) {
    post({ type: "ERROR", id, message: err instanceof Error ? err.message : String(err) });
  } finally {
    activeControllers.delete(id);
  }
}

function post(response: WorkerResponse): void {
  ctx.postMessage(response);
}
