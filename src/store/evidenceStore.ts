import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  EvtxEvent,
  SuspiciousFinding,
  InvestigationSummary,
  UploadedFileMeta,
  LoadStatus,
} from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import { mergeAndSortEvents, synthesizeUploadedFileMeta, type ParsedFileResult } from "@/lib/multiFile";

/**
 * Source-of-truth store for everything that comes out of the backend
 * pipeline for the currently loaded case: the uploaded file(s), the merged
 * parsed events, suspicious findings, and the generated investigation
 * summary — plus the loading/error state of that pipeline.
 *
 * Kept separate from `filterStore` (view state) and `uiStore` (ephemeral
 * UI state) so that filtering/sorting/pagination interactions don't
 * trigger re-renders of consumers that only care about raw evidence data,
 * and vice versa.
 */

interface EvidenceState {
  /** Single-record summary of the loaded case — for one file, that file's
   * own metadata; for multiple files, a synthesized summary (see
   * `lib/multiFile.ts#synthesizeUploadedFileMeta`). Every consumer that
   * predates Phase 5.7 (notes/bookmarks case-id namespacing, the Report's
   * cover page, `CaseStateGate`, the Navbar badge) reads this field
   * unchanged, so none of them needed to be rewritten for multi-file. */
  uploadedFile: UploadedFileMeta | null;
  /** Phase 5.7 — every successfully parsed file in the current
   * investigation, in upload order. Empty when no case is loaded. This is
   * the new, authoritative source for anything that needs the real list
   * (file badges, per-file statistics, the Evidence Table's Source filter,
   * the Report's Evidence Sources section) rather than the single
   * synthesized `uploadedFile` above. */
  uploadedFiles: UploadedFileMeta[];
  /** Names of files that failed to parse during the most recent
   * `loadFiles` call. Non-blocking: if at least one file in a multi-file
   * upload succeeds, the case still loads normally using the successful
   * files, and this array lets the upload UI surface a warning about the
   * rest. Cleared at the start of every new `loadFiles` call. */
  failedFiles: string[];
  events: EvtxEvent[];
  suspiciousFindings: SuspiciousFinding[];
  investigationSummary: InvestigationSummary | null;
  /** Phase 5.4 — the modular IOC Detection Engine's own, richer findings
   * (title/description/severity/MITRE technique/recommendation), computed
   * once per file load alongside `suspiciousFindings` (see `loadFiles`
   * below) rather than by a second detection pass. Powers the Dashboard's
   * IOC panel, Threat Score breakdown, Timeline icons, and Event Drawer.
   * Phase 5.7: unchanged — it's handed the already-merged `events` array
   * and runs exactly once regardless of how many files contributed to it. */
  iocFindings: DetectionFinding[];
  /** `iocFindings` grouped by `EvtxEvent.id`, precomputed once at load time
   * so every IOC indicator/detail component (Timeline rows, Event Drawer)
   * gets an O(1) lookup instead of filtering `iocFindings` on every render. */
  iocFindingsByEvent: Record<string, DetectionFinding[]>;

  status: LoadStatus;
  error: string | null;

  /** Orchestrates the full parse -> merge -> detect -> summarize pipeline
   * for one or more files (Phase 5.7). Each file is parsed fully
   * independently via the existing, unmodified `parseEVTX` — a failure in
   * one file never aborts the others; see `failedFiles` above. */
  loadFiles: (files: File[]) => Promise<void>;
  /** Backward-compatible single-file entry point, kept so any existing
   * caller/reference to the pre-5.7 API keeps working unchanged. Thin
   * wrapper around `loadFiles([file])` — not a separate code path. */
  loadFile: (file: File) => Promise<void>;
  reset: () => void;
}

const initialState = {
  uploadedFile: null,
  uploadedFiles: [] as UploadedFileMeta[],
  failedFiles: [] as string[],
  events: [] as EvtxEvent[],
  suspiciousFindings: [] as SuspiciousFinding[],
  investigationSummary: null,
  iocFindings: [] as DetectionFinding[],
  iocFindingsByEvent: {} as Record<string, DetectionFinding[]>,
  status: "idle" as LoadStatus,
  error: null,
};

export const useEvidenceStore = create<EvidenceState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      loadFiles: async (files: File[]) => {
        if (files.length === 0) return;

        const fileMetas: UploadedFileMeta[] = files.map((file) => ({
          name: file.name,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        }));

        set(
          {
            uploadedFiles: fileMetas,
            uploadedFile: synthesizeUploadedFileMeta(fileMetas),
            status: "parsing",
            error: null,
            failedFiles: [],
          },
          false,
          "evidence/loadFiles:start",
        );

        // Dynamically imported rather than statically at the top of this
        // file: @ts-evtx/core (the parser's dependency) is one of the
        // heaviest chunks in the app. Deferring it here means the landing
        // page's initial load doesn't pay for it until someone actually
        // drops a file — Vite/Rollup code-splits this into its own chunk
        // automatically. Pure bundling change, no behavior difference.
        const { parseEVTX, detectIOCs, adaptToSuspiciousFindings, generateInvestigationSummary } =
          await import("@/services/evtxApi");

        // Every file is parsed fully independently via the same,
        // unmodified `parseEVTX` used for a single file — `Promise.allSettled`
        // (rather than `Promise.all`) so one bad file's rejection can't
        // abort the others; the shared parser Worker already supports
        // multiple in-flight parse requests (see worker-client.ts's
        // `pending` map keyed by request id), so these genuinely run
        // concurrently rather than needing to be awaited one at a time.
        const settled = await Promise.allSettled(
          files.map(async (file, index): Promise<ParsedFileResult> => {
            const events = await parseEVTX(file);
            return { meta: fileMetas[index], events };
          }),
        );

        const parsedResults: ParsedFileResult[] = [];
        const failedFiles: string[] = [];
        settled.forEach((result, index) => {
          if (result.status === "fulfilled") {
            parsedResults.push(result.value);
          } else {
            failedFiles.push(fileMetas[index].name);
          }
        });

        if (parsedResults.length === 0) {
          // Every file failed — the only case that should put the whole
          // pipeline in an error state, same contract as the pre-5.7
          // single-file path: this is real evidence data failing to
          // extract, not a "nice to have" feature being unavailable.
          set(
            {
              status: "error",
              error:
                files.length === 1
                  ? "Failed to parse the uploaded file."
                  : `Failed to parse all ${files.length} uploaded files.`,
              failedFiles,
            },
            false,
            "evidence/loadFiles:parseError",
          );
          return;
        }

        // Merge: tag each file's events with their source filename, sort
        // the combined set chronologically (lib/multiFile.ts). For a
        // single successfully-parsed file this is behaviorally identical
        // to the pre-5.7 pipeline (see mergeAndSortEvents's doc comment on
        // why IDs are left untouched in that case).
        const events = mergeAndSortEvents(parsedResults);
        const successfulMetas = parsedResults.map((result) => result.meta);

        set(
          {
            events,
            uploadedFiles: successfulMetas,
            uploadedFile: synthesizeUploadedFileMeta(successfulMetas),
            status: "analyzing",
            failedFiles,
          },
          false,
          "evidence/loadFiles:parsed",
        );

        // IOC detection (src/lib/detection/, Phase 5.4) and investigation
        // summary generation are kept best-effort here: a bug in a
        // detection rule must never undo an otherwise-successful parse.
        // The evidence table and timeline only need `events`, so we
        // degrade to empty results rather than surfacing an error for an
        // otherwise-working case.
        //
        // `detectIOCs` runs the full 14-rule engine exactly once over the
        // already-merged `events` array — it has no awareness of file
        // boundaries, so multi-file threat detection and MITRE aggregation
        // fall out of this unchanged call automatically. Both
        // `suspiciousFindings` (the narrower shape lib/report.ts and
        // generateInvestigationSummary expect) and `iocFindingsByEvent`
        // (the per-event lookup Timeline/Event Drawer use) are derived
        // from that single result rather than triggering a second pass.
        let iocFindings: DetectionFinding[] = [];
        let iocFindingsByEvent: Record<string, DetectionFinding[]> = {};
        let suspiciousFindings: SuspiciousFinding[] = [];
        let investigationSummary: InvestigationSummary | null = null;
        try {
          iocFindings = detectIOCs(events);
          iocFindingsByEvent = {};
          for (const finding of iocFindings) {
            const bucket = iocFindingsByEvent[finding.eventId];
            if (bucket) bucket.push(finding);
            else iocFindingsByEvent[finding.eventId] = [finding];
          }
          suspiciousFindings = adaptToSuspiciousFindings(iocFindings);
          investigationSummary = await generateInvestigationSummary(events, suspiciousFindings);
        } catch {
          // Expected until detection/summary are implemented — no-op.
        }

        set(
          { iocFindings, iocFindingsByEvent, suspiciousFindings, investigationSummary, status: "ready" },
          false,
          "evidence/loadFiles:ready",
        );
      },

      loadFile: (file: File) => get().loadFiles([file]),

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
