import * as React from "react";
import { toast } from "sonner";
import { Bookmark, Crosshair, FileText, History, Loader2, PackageCheck, ShieldAlert, StickyNote, Table2, type LucideIcon } from "lucide-react";

import type { EvtxEvent, InvestigationSummary, SuspiciousFinding, UploadedFileMeta } from "@/types/evidence";
import type { DetectionFinding } from "@/lib/detection/types";
import type { MitreAggregation } from "@/lib/mitre/types";
import type { CaseNote, EventNoteMap } from "@/lib/notes";
import type { BookmarkMap } from "@/lib/bookmarks";
import { useEvidenceStore } from "@/store/evidenceStore";
import { useNotesStore, useEnsureCaseNotesLoaded } from "@/store/notesStore";
import { useBookmarksStore, useEnsureCaseBookmarksLoaded, useBookmarkCount } from "@/store/bookmarksStore";
import { useCaseMetadata, useHydrateCaseStore } from "@/store/caseStore";
import { useExportHistoryStore, useHydrateExportHistory } from "@/store/exportStore";
import { aggregateMitreFindings } from "@/lib/mitre/aggregation";
import { downloadBlob } from "@/lib/download-blob";
import { formatFileSize } from "@/lib/utils";
import { exportCSV } from "@/services/evtxApi";
import {
  EXPORT_DEFINITIONS,
  IDLE_EXPORT_STATUS,
  isExportBusy,
  type ExportFormat,
  type ExportKind,
  type ExportMetadataHeader,
  type ExportStatus,
} from "@/lib/export/types";
import { buildIocCsvBlob, buildMitreCsvBlob, buildTimelineCsvBlob } from "@/lib/export/csv";
import {
  buildBookmarksJsonBlob,
  buildEvidenceJsonBlob,
  buildIocJsonBlob,
  buildMitreJsonBlob,
  buildNotesJsonBlob,
} from "@/lib/export/json";
import { buildExportManifest, buildManifestBlob } from "@/lib/export/manifest";
import { buildReportContext } from "@/lib/export/reportContext";
import { buildInvestigationBundle } from "@/lib/export/zip";
import { Button } from "@/components/ui/button";
import { ExportCard } from "@/components/export/ExportCard";
import { ExportHistory } from "@/components/export/ExportHistory";

interface ExportCenterProps {
  events: EvtxEvent[];
}

const EXPORT_ICON: Record<ExportKind, LucideIcon> = {
  report: FileText,
  evidence: Table2,
  timeline: History,
  iocs: ShieldAlert,
  mitre: Crosshair,
  notes: StickyNote,
  bookmarks: Bookmark,
  bundle: PackageCheck,
};

const EMPTY_EVENT_NOTES: EventNoteMap = {};
const EMPTY_BOOKMARKS: BookmarkMap = {};

function createIdleStatuses(): Record<ExportKind, ExportStatus> {
  const statuses = {} as Record<ExportKind, ExportStatus>;
  for (const definition of EXPORT_DEFINITIONS) statuses[definition.id] = IDLE_EXPORT_STATUS;
  return statuses;
}

function createDefaultFormats(): Record<ExportKind, ExportFormat> {
  const formats = {} as Record<ExportKind, ExportFormat>;
  for (const definition of EXPORT_DEFINITIONS) formats[definition.id] = definition.formats[0];
  return formats;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Yields one tick so React actually paints the "Preparing…"/"Generating…"
 * status before the synchronous CSV/JSON/PDF-building work below blocks the
 * main thread — same pattern `GenerateReportButton.tsx` already uses, per
 * this phase's "Do not block unrelated UI" performance requirement. */
function yieldTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fallbackFilename(kind: ExportKind, format: ExportFormat): string {
  return `dfir-${kind}-${stamp()}.${format}`;
}

/** "13. UI — File size estimate if available." Rough, honest byte-per-row
 * heuristics for the formats cheap to estimate (CSV/JSON over an
 * already-known item count); omitted (returns `undefined`) for the PDF
 * report and the ZIP bundle, whose real size depends on jsPDF/JSZip's own
 * layout and compression — a guess there would be more misleading than
 * useful. */
function estimateExportSize(
  kind: ExportKind,
  format: ExportFormat,
  counts: { events: number; iocs: number; mitreTechniques: number; notes: number; bookmarks: number },
): string | undefined {
  const BYTES_PER_ITEM: Partial<Record<`${ExportKind}:${ExportFormat}`, number>> = {
    "evidence:csv": 220,
    "evidence:json": 480,
    "timeline:csv": 150,
    "iocs:csv": 220,
    "iocs:json": 420,
    "mitre:csv": 180,
    "mitre:json": 360,
    "notes:json": 180,
    "bookmarks:json": 40,
  };
  const bytesPerItem = BYTES_PER_ITEM[`${kind}:${format}`];
  if (bytesPerItem === undefined) return undefined;

  const count =
    kind === "evidence" || kind === "timeline"
      ? counts.events
      : kind === "iocs"
        ? counts.iocs
        : kind === "mitre"
          ? counts.mitreTechniques
          : kind === "notes"
            ? counts.notes
            : counts.bookmarks;

  return formatFileSize(bytesPerItem * count);
}

interface ExportBuildContext {
  uploadedFile: UploadedFileMeta;
  uploadedFiles: UploadedFileMeta[];
  events: EvtxEvent[];
  investigationSummary: InvestigationSummary | null;
  suspiciousFindings: SuspiciousFinding[];
  iocFindings: DetectionFinding[];
  mitreAggregation: MitreAggregation;
  eventById: Map<string, EvtxEvent>;
  caseNote: CaseNote | null;
  eventNotes: EventNoteMap;
  bookmarkMap: BookmarkMap;
  metadata: ExportMetadataHeader;
}

interface ExportResult {
  blob: Blob;
  filename: string;
}

/**
 * Builds one export's `Blob` + filename. `jspdf`/`jszip` are dynamically
 * imported only inside the branches that actually need them (`report`/
 * `bundle`), so choosing a CSV or JSON card never fetches either library —
 * same "heavy dependency, load on demand" contract every dynamic import in
 * this codebase already follows.
 */
async function buildExport(kind: ExportKind, format: ExportFormat, ctx: ExportBuildContext): Promise<ExportResult> {
  switch (kind) {
    case "report": {
      const { generateReportPdf } = await import("@/services/report/pdfGenerator");
      const { reportData, reportExtras } = buildReportContext({
        uploadedFile: ctx.uploadedFile,
        uploadedFiles: ctx.uploadedFiles,
        events: ctx.events,
        investigationSummary: ctx.investigationSummary,
        suspiciousFindings: ctx.suspiciousFindings,
        caseNote: ctx.caseNote,
        eventNotes: ctx.eventNotes,
        bookmarks: ctx.bookmarkMap,
        mitreAggregation: ctx.mitreAggregation,
      });
      const blob = generateReportPdf(reportData, reportExtras);
      return { blob, filename: `dfir-investigation-report-${stamp()}.pdf` };
    }

    case "evidence":
      return format === "csv"
        ? { blob: exportCSV(ctx.events), filename: `dfir-evidence-${stamp()}.csv` }
        : { blob: buildEvidenceJsonBlob(ctx.metadata, ctx.events), filename: `dfir-evidence-${stamp()}.json` };

    case "timeline":
      return { blob: buildTimelineCsvBlob(ctx.events), filename: `dfir-timeline-${stamp()}.csv` };

    case "iocs":
      return format === "csv"
        ? { blob: buildIocCsvBlob(ctx.iocFindings, ctx.eventById), filename: `dfir-iocs-${stamp()}.csv` }
        : { blob: buildIocJsonBlob(ctx.metadata, ctx.iocFindings), filename: `dfir-iocs-${stamp()}.json` };

    case "mitre":
      return format === "csv"
        ? { blob: buildMitreCsvBlob(ctx.mitreAggregation.techniques), filename: `dfir-mitre-${stamp()}.csv` }
        : {
            blob: buildMitreJsonBlob(ctx.metadata, ctx.mitreAggregation.techniques),
            filename: `dfir-mitre-${stamp()}.json`,
          };

    case "notes":
      return {
        blob: buildNotesJsonBlob(ctx.metadata, ctx.caseNote, ctx.eventNotes),
        filename: `dfir-notes-${stamp()}.json`,
      };

    case "bookmarks":
      return {
        blob: buildBookmarksJsonBlob(ctx.metadata, ctx.bookmarkMap),
        filename: `dfir-bookmarks-${stamp()}.json`,
      };

    case "bundle": {
      const { generateReportPdf } = await import("@/services/report/pdfGenerator");
      const { reportData, reportExtras } = buildReportContext({
        uploadedFile: ctx.uploadedFile,
        uploadedFiles: ctx.uploadedFiles,
        events: ctx.events,
        investigationSummary: ctx.investigationSummary,
        suspiciousFindings: ctx.suspiciousFindings,
        caseNote: ctx.caseNote,
        eventNotes: ctx.eventNotes,
        bookmarks: ctx.bookmarkMap,
        mitreAggregation: ctx.mitreAggregation,
      });
      const reportPdf = generateReportPdf(reportData, reportExtras);

      const manifest = buildExportManifest({
        caseId: ctx.metadata.caseId,
        caseName: ctx.metadata.caseName,
        sourceFiles: ctx.metadata.sourceFiles,
        eventCount: ctx.metadata.eventCount,
        iocCount: ctx.iocFindings.length,
        mitreTechniqueCount: ctx.mitreAggregation.techniques.length,
        bookmarkCount: Object.keys(ctx.bookmarkMap).length,
        noteCount: (ctx.caseNote ? 1 : 0) + Object.keys(ctx.eventNotes).length,
        threatScore: ctx.investigationSummary?.riskScore.score ?? 0,
        threatLevel: ctx.investigationSummary?.riskScore.level ?? "low",
      });

      const blob = await buildInvestigationBundle({
        reportPdf,
        evidenceCsv: exportCSV(ctx.events),
        evidenceJson: buildEvidenceJsonBlob(ctx.metadata, ctx.events),
        timelineCsv: buildTimelineCsvBlob(ctx.events),
        iocsCsv: buildIocCsvBlob(ctx.iocFindings, ctx.eventById),
        iocsJson: buildIocJsonBlob(ctx.metadata, ctx.iocFindings),
        mitreCsv: buildMitreCsvBlob(ctx.mitreAggregation.techniques),
        mitreJson: buildMitreJsonBlob(ctx.metadata, ctx.mitreAggregation.techniques),
        notesJson: buildNotesJsonBlob(ctx.metadata, ctx.caseNote, ctx.eventNotes),
        bookmarksJson: buildBookmarksJsonBlob(ctx.metadata, ctx.bookmarkMap),
        manifestJson: buildManifestBlob(manifest),
      });
      return { blob, filename: `dfir-investigation-bundle-${stamp()}.zip` };
    }
  }
}

/**
 * Export Center (Phase 5.11) — every export this app can produce for the
 * currently loaded case, in one place. Rendered as `CaseStateGate`'s
 * render-prop child (`ExportPage.tsx`), so `events` here is always
 * non-empty and `uploadedFile` is guaranteed to have been loaded — the
 * `if (!uploadedFile) return null` guard below is defensive only (never
 * actually reached), matching the "hooks first, conditional render after"
 * shape `CaseStateGate` itself already uses.
 *
 * Reuses every existing export/report primitive (`generateReportPdf`,
 * `exportCSV`, `downloadBlob`, `aggregateMitreFindings`,
 * `buildReportData`) rather than re-implementing any of them — the only
 * genuinely new *logic* here is the CSV/JSON builders for shapes that
 * never had one (Timeline/IOC/MITRE/Notes/Bookmarks — `lib/export/csv.ts`
 * and `lib/export/json.ts`) and the ZIP bundle assembly
 * (`lib/export/zip.ts`).
 */
export function ExportCenter({ events }: ExportCenterProps) {
  const uploadedFile = useEvidenceStore((s) => s.uploadedFile);
  const uploadedFiles = useEvidenceStore((s) => s.uploadedFiles);
  const iocFindings = useEvidenceStore((s) => s.iocFindings);
  const investigationSummary = useEvidenceStore((s) => s.investigationSummary);
  const suspiciousFindings = useEvidenceStore((s) => s.suspiciousFindings);

  const caseId = uploadedFile?.name ?? null;

  useEnsureCaseNotesLoaded(caseId);
  useEnsureCaseBookmarksLoaded(caseId);
  useHydrateCaseStore();
  useHydrateExportHistory();

  const caseNote = useNotesStore((s) => (caseId ? (s.caseNotes[caseId] ?? null) : null));
  const eventNotes = useNotesStore((s) => (caseId ? s.eventNotes[caseId] : undefined)) ?? EMPTY_EVENT_NOTES;
  const bookmarkMap = useBookmarksStore((s) => (caseId ? s.bookmarks[caseId] : undefined)) ?? EMPTY_BOOKMARKS;
  const bookmarkCount = useBookmarkCount(caseId);
  const caseMetadata = useCaseMetadata(caseId);

  const recordHistory = useExportHistoryStore((s) => s.record);

  const [statuses, setStatuses] = React.useState<Record<ExportKind, ExportStatus>>(createIdleStatuses);
  const [formats, setFormats] = React.useState<Record<ExportKind, ExportFormat>>(createDefaultFormats);

  const eventById = React.useMemo(() => {
    const map = new Map<string, EvtxEvent>();
    for (const event of events) map.set(event.id, event);
    return map;
  }, [events]);

  const mitreAggregation = React.useMemo(() => aggregateMitreFindings(iocFindings), [iocFindings]);

  // Case Library's own (possibly renamed) name when this case has been
  // saved there — read-only cross-feature reuse of Phase 5.10's storage,
  // never written to. Falls back to the raw case id (filename) when this
  // case hasn't been saved to the library yet, which is still a perfectly
  // valid, honest case name.
  const caseName = caseMetadata?.name ?? caseId ?? "Untitled Case";
  const noteCount = (caseNote ? 1 : 0) + Object.keys(eventNotes).length;

  const setCardFormat = React.useCallback((kind: ExportKind, format: ExportFormat) => {
    setFormats((prev) => ({ ...prev, [kind]: format }));
  }, []);

  const handleExport = React.useCallback(
    async (kind: ExportKind) => {
      if (!uploadedFile || !caseId) return;
      const format = formats[kind];
      const setStatus = (status: ExportStatus) => setStatuses((prev) => ({ ...prev, [kind]: status }));

      setStatus({ stage: "preparing", error: null });
      await yieldTick();

      try {
        setStatus({ stage: "generating", error: null });
        await yieldTick();

        const metadata: ExportMetadataHeader = {
          caseId,
          caseName,
          generatedAt: new Date().toISOString(),
          sourceFiles: uploadedFiles.map((file) => file.name),
          eventCount: events.length,
        };

        if (kind === "bundle") {
          setStatus({ stage: "packaging", error: null });
          await yieldTick();
        }

        const result = await buildExport(kind, format, {
          uploadedFile,
          uploadedFiles,
          events,
          investigationSummary,
          suspiciousFindings,
          iocFindings,
          mitreAggregation,
          eventById,
          caseNote,
          eventNotes,
          bookmarkMap,
          metadata,
        });

        setStatus({ stage: "downloading", error: null });
        downloadBlob(result.blob, result.filename);
        setStatus({ stage: "completed", error: null });

        recordHistory(result.filename, format, "success");
        toast.success("Export ready", { description: result.filename });
        window.setTimeout(() => setStatus(IDLE_EXPORT_STATUS), 2500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        setStatus({ stage: "failed", error: message });
        recordHistory(fallbackFilename(kind, format), format, "failed");
        toast.error("Export failed", { description: message });
        window.setTimeout(() => setStatus(IDLE_EXPORT_STATUS), 4000);
      }
    },
    [
      uploadedFile,
      caseId,
      caseName,
      formats,
      uploadedFiles,
      events,
      investigationSummary,
      suspiciousFindings,
      iocFindings,
      mitreAggregation,
      eventById,
      caseNote,
      eventNotes,
      bookmarkMap,
      recordHistory,
    ],
  );

  if (!uploadedFile || !caseId) return null;

  const bundleStatus = statuses.bundle;
  const anyBusy = EXPORT_DEFINITIONS.some((definition) => isExportBusy(statuses[definition.id]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Export Everything</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Packages the report, evidence, timeline, IOC findings, MITRE coverage, notes, and bookmarks into one ZIP.
          </p>
        </div>
        <Button
          type="button"
          className="gap-1.5"
          disabled={anyBusy}
          aria-busy={isExportBusy(bundleStatus)}
          onClick={() => void handleExport("bundle")}
        >
          {isExportBusy(bundleStatus) ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
          )}
          Export Everything
        </Button>
      </div>

      {/* "18. Responsive" — 1 column mobile, 2 tablet, 3 desktop. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {EXPORT_DEFINITIONS.map((definition) => (
          <ExportCard
            key={definition.id}
            icon={EXPORT_ICON[definition.id]}
            title={definition.title}
            description={definition.description}
            formats={definition.formats}
            selectedFormat={formats[definition.id]}
            onFormatChange={(format) => setCardFormat(definition.id, format)}
            sizeEstimateLabel={estimateExportSize(definition.id, formats[definition.id], {
              events: events.length,
              iocs: iocFindings.length,
              mitreTechniques: mitreAggregation.techniques.length,
              notes: noteCount,
              bookmarks: bookmarkCount,
            })}
            status={statuses[definition.id]}
            onExport={() => void handleExport(definition.id)}
          />
        ))}
      </div>

      <ExportHistory />
    </div>
  );
}
