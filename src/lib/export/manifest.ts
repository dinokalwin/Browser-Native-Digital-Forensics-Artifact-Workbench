/**
 * Export Center — manifest builder (Phase 5.11, ticket "10. Manifest").
 *
 * Pure, framework-free. `EXPORT_APP_VERSION` mirrors
 * `lib/report.ts#REPORT_APP_VERSION`'s own "read the app version straight
 * out of package.json rather than hand-maintaining a constant" approach.
 */
import packageJson from "../../../package.json";

import type { RiskLevel } from "@/types/evidence";
import type { ExportManifest } from "./types";

export const EXPORT_APP_VERSION: string = packageJson.version;

export interface BuildExportManifestInput {
  caseId: string;
  caseName: string;
  sourceFiles: string[];
  eventCount: number;
  iocCount: number;
  mitreTechniqueCount: number;
  bookmarkCount: number;
  noteCount: number;
  threatScore: number;
  threatLevel: RiskLevel;
}

/** Stamps `generatedAt`/`exportVersion` at call time — every other field is
 * a snapshot the caller already computed from `evidenceStore`/
 * `notesStore`/`bookmarksStore`, the same "this module never re-derives
 * data another module already owns" contract `lib/cases/storage.ts#upsertCase`
 * follows for case metadata. */
export function buildExportManifest(input: BuildExportManifestInput): ExportManifest {
  return {
    ...input,
    generatedAt: new Date().toISOString(),
    exportVersion: EXPORT_APP_VERSION,
  };
}

export function buildManifestBlob(manifest: ExportManifest): Blob {
  return new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
}
