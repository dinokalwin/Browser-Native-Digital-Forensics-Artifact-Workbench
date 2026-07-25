import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  EvtxEvent,
  SuspiciousFinding,
  InvestigationSummary,
  UploadedFileMeta,
  LoadStatus,
} from "@/types/evidence";

/**
 * Source-of-truth store for everything that comes out of the backend
 * pipeline for the currently loaded case file: the uploaded file, the
 * parsed events, suspicious findings, and the generated investigation
 * summary — plus the loading/error state of that pipeline.
 *
 * Kept separate from `filterStore` (view state) and `uiStore` (ephemeral
 * UI state) so that filtering/sorting/pagination interactions don't
 * trigger re-renders of consumers that only care about raw evidence data,
 * and vice versa.
 */

interface EvidenceState {
  uploadedFile: UploadedFileMeta | null;
  events: EvtxEvent[];
  suspiciousFindings: SuspiciousFinding[];
  investigationSummary: InvestigationSummary | null;

  status: LoadStatus;
  error: string | null;

  /** Orchestrates the full parse -> detect -> summarize pipeline. */
  loadFile: (file: File) => Promise<void>;
  reset: () => void;
}

const initialState = {
  uploadedFile: null,
  events: [],
  suspiciousFindings: [],
  investigationSummary: null,
  status: "idle" as LoadStatus,
  error: null,
};

export const useEvidenceStore = create<EvidenceState>()(
  devtools(
    (set) => ({
      ...initialState,

      loadFile: async (file: File) => {
        const uploadedFile: UploadedFileMeta = {
          name: file.name,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        };

        set(
          { uploadedFile, status: "parsing", error: null },
          false,
          "evidence/loadFile:start",
        );

        // Dynamically imported rather than statically at the top of this
        // file: @ts-evtx/core (the parser's dependency) is one of the
        // heaviest chunks in the app. Deferring it here means the landing
        // page's initial load doesn't pay for it until someone actually
        // drops a file — Vite/Rollup code-splits this into its own chunk
        // automatically. Pure bundling change, no behavior difference.
        const { parseEVTX, detectSuspicious, generateInvestigationSummary } = await import(
          "@/services/evtxApi"
        );

        let events: EvtxEvent[];
        try {
          events = await parseEVTX(file);
        } catch (err) {
          // A failed parse is the only thing that should put the pipeline
          // in an error state — this is real evidence data failing to
          // extract, not a "nice to have" feature being unavailable.
          set(
            {
              status: "error",
              error:
                err instanceof Error
                  ? err.message
                  : "Failed to parse the uploaded file.",
            },
            false,
            "evidence/loadFile:parseError",
          );
          return;
        }

        set(
          { events, status: "analyzing" },
          false,
          "evidence/loadFile:parsed",
        );

        // Suspicious-event detection and investigation summary generation
        // (src/backend/suspicious-detection.ts, investigation-summary.ts)
        // are real as of Phase 7, but still kept best-effort here: a bug
        // in a detection rule must never undo an otherwise-successful
        // parse. The evidence table and timeline only need `events`, so
        // we degrade to empty results rather than surfacing an error for
        // an otherwise-working case.
        let suspiciousFindings: SuspiciousFinding[] = [];
        let investigationSummary: InvestigationSummary | null = null;
        try {
          suspiciousFindings = await detectSuspicious(events);
          investigationSummary = await generateInvestigationSummary(
            events,
            suspiciousFindings,
          );
        } catch {
          // Expected until detection/summary are implemented — no-op.
        }

        set(
          { suspiciousFindings, investigationSummary, status: "ready" },
          false,
          "evidence/loadFile:ready",
        );
      },

      reset: () => set(initialState, false, "evidence/reset"),
    }),
    { name: "evidence-store" },
  ),
);

// Convenience selectors — import these instead of the whole store where
// possible to minimize re-renders.
export const selectEvents = (s: EvidenceState) => s.events;
export const selectStatus = (s: EvidenceState) => s.status;
export const selectIsLoading = (s: EvidenceState) =>
  s.status === "parsing" || s.status === "analyzing";
