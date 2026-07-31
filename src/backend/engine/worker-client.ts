/**
 * Owns the parsing Worker's lifecycle: lazy spawn, reuse across files
 * (avoiding per-file spin-up cost), a real enforced timeout, and clean
 * termination. This is the only file that constructs the Worker.
 */
import type { EvtxEvent } from "@/types/evidence";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes — guards against a pathological/adversarial file.

interface Pending {
  resolve: (events: EvtxEvent[]) => void;
  reject: (err: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
const pending = new Map<string, Pending>();
let nextId = 0;

function ensureWorker(): Worker {
  if (worker) return worker;

  // `new URL(..., import.meta.url)` + `{ type: 'module' }` is Vite's
  // documented worker-import pattern — statically detected at build time
  // and emitted as its own bundled chunk in both dev and production.
  const w = new Worker(new URL("./parser.worker.ts", import.meta.url), { type: "module" });

  w.addEventListener("message", (event: MessageEvent) => {
    const msg = event.data;
    const entry = pending.get(msg.id);
    if (!entry) return; // Already settled/cancelled — ignore stray messages.

    if (msg.type === "RESULT") {
      clearTimeout(entry.timeoutHandle);
      pending.delete(msg.id);
      entry.resolve(msg.events);
    } else if (msg.type === "ERROR") {
      clearTimeout(entry.timeoutHandle);
      pending.delete(msg.id);
      entry.reject(new Error(msg.message));
    }
    // PROGRESS messages are handled by the caller's own listener registered in parseInWorker().
  });

  w.addEventListener("error", (event) => {
    const error = new Error(
      `EVTX parser worker crashed: ${event.message || "unknown worker error"}`,
    );
    for (const [id, entry] of pending) {
      clearTimeout(entry.timeoutHandle);
      entry.reject(error);
      pending.delete(id);
    }
    worker?.terminate();
    worker = null;
  });

  worker = w;
  return w;
}

export function parseInWorker(
  buffer: ArrayBuffer,
  options: {
    onProgress?: (p: {
      chunksProcessed: number;
      totalChunks: number;
      eventsParsedSoFar: number;
    }) => void;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<EvtxEvent[]> {
  const w = ensureWorker();
  const id = `req-${++nextId}-${Date.now()}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<EvtxEvent[]>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error("Parsing was cancelled."));
      return;
    }

    const abortListener = () => {
      w.postMessage({ type: "CANCEL", id });
      const entry = pending.get(id);
      if (entry) {
        clearTimeout(entry.timeoutHandle);
        pending.delete(id);
      }
      reject(new Error("Parsing was cancelled."));
    };
    options.signal?.addEventListener("abort", abortListener, { once: true });

    const messageListener = (event: MessageEvent) => {
      if (event.data?.type === "PROGRESS" && event.data.id === id) {
        options.onProgress?.({
          chunksProcessed: event.data.chunksProcessed,
          totalChunks: event.data.totalChunks,
          eventsParsedSoFar: event.data.eventsParsedSoFar,
        });
      }
    };
    w.addEventListener("message", messageListener);

    const timeoutHandle = setTimeout(() => {
      w.postMessage({ type: "CANCEL", id });
      pending.delete(id);
      w.removeEventListener("message", messageListener);
      reject(new Error(`Parsing did not complete within ${timeoutMs}ms and was cancelled.`));
    }, timeoutMs);

    pending.set(id, {
      resolve: (events) => {
        w.removeEventListener("message", messageListener);
        resolve(events);
      },
      reject: (err) => {
        w.removeEventListener("message", messageListener);
        reject(err);
      },
      timeoutHandle,
    });

    // Transfer the buffer (zero-copy) rather than structured-cloning it —
    // safe because parseInWorker's caller reads the File into a fresh
    // ArrayBuffer per call and doesn't need it afterward.
    w.postMessage({ type: "PARSE", id, buffer }, [buffer]);
  });
}

/** Terminates the worker and frees everything it holds. Safe to call even if no worker was ever created. */
export function disposeParserWorker(): void {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timeoutHandle);
    entry.reject(new Error("Worker was terminated while parsing was in progress."));
    pending.delete(id);
  }
  worker?.terminate();
  worker = null;
}
