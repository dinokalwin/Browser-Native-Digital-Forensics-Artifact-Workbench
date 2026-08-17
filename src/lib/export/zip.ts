/**
 * Export Center — ZIP bundle assembly (Phase 5.11, ticket "8. ZIP BUNDLE" /
 * "9. ZIP LIBRARY").
 *
 * `jszip` is dynamically imported inside `buildInvestigationBundle` rather
 * than statically at the top of this file — same "heavy library, fetch on
 * demand" convention as `jspdf`/`jspdf-autotable`
 * (`services/report/pdfGenerator.ts`) and `@ts-evtx/core`
 * (`evidenceStore.ts#loadFiles`). Vite/Rollup code-splits this module (and
 * `jszip` itself) into its own chunk, so an investigator who never clicks
 * "Complete Investigation Bundle" or "Export Everything" never pays for
 * it — not even as part of the Export Center page's own chunk, since nothing
 * else in `components/export/` imports this file except the one handler
 * that needs it.
 *
 * This module only knows how to lay out and zip already-built parts — it
 * has no knowledge of `EvtxEvent`, `DetectionFinding`, `ReportData`, or any
 * other domain type, matching every other `lib/*` module's "pure function
 * of its arguments" contract in this project. `ExportCenter.tsx` is the
 * only thing that builds the individual `Blob`s (via `csv.ts`/`json.ts`/
 * `manifest.ts`/`generateReportPdf`) and hands them here.
 */

export interface InvestigationBundleParts {
  reportPdf: Blob;
  evidenceCsv: Blob;
  evidenceJson: Blob;
  timelineCsv: Blob;
  iocsCsv: Blob;
  iocsJson: Blob;
  mitreCsv: Blob;
  mitreJson: Blob;
  notesJson: Blob;
  bookmarksJson: Blob;
  manifestJson: Blob;
}

/**
 * Builds the ZIP exactly per this phase's ticket folder structure:
 *
 * ```
 * DFIR-Investigation/
 * ├── report/investigation.pdf
 * ├── evidence/{events.csv,events.json}
 * ├── timeline/timeline.csv
 * ├── iocs/{iocs.csv,iocs.json}
 * ├── mitre/{mitre.csv,mitre.json}
 * ├── notes/notes.json
 * ├── bookmarks/bookmarks.json
 * └── manifest.json
 * ```
 *
 * Deliberately never includes the raw uploaded EVTX file(s) — this phase's
 * explicit "Do not include raw EVTX files" instruction — because nothing
 * in `evidenceStore` retains the original `File`/`ArrayBuffer` past parse
 * time in the first place; there is nothing here that *could* smuggle one
 * in even by accident.
 */
export async function buildInvestigationBundle(parts: InvestigationBundleParts): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const root = zip.folder("DFIR-Investigation");
  if (!root) {
    throw new Error("Failed to initialize the ZIP archive.");
  }

  root.folder("report")?.file("investigation.pdf", parts.reportPdf);

  const evidence = root.folder("evidence");
  evidence?.file("events.csv", parts.evidenceCsv);
  evidence?.file("events.json", parts.evidenceJson);

  root.folder("timeline")?.file("timeline.csv", parts.timelineCsv);

  const iocs = root.folder("iocs");
  iocs?.file("iocs.csv", parts.iocsCsv);
  iocs?.file("iocs.json", parts.iocsJson);

  const mitre = root.folder("mitre");
  mitre?.file("mitre.csv", parts.mitreCsv);
  mitre?.file("mitre.json", parts.mitreJson);

  root.folder("notes")?.file("notes.json", parts.notesJson);
  root.folder("bookmarks")?.file("bookmarks.json", parts.bookmarksJson);

  root.file("manifest.json", parts.manifestJson);

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
