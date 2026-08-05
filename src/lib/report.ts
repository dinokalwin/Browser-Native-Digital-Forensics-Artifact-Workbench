/**
 * Investigation Report — data assembly (Sprint 5.1).
 *
 * Pure, framework-free: no React, no Zustand, no jsPDF. Same contract as
 * `lib/statistics.ts` / `lib/eventFilters.ts` / `lib/timeline.ts` — a
 * plain function of its arguments, safe to call from a component or a
 * unit test with identical results. `buildReportData` doesn't compute
 * anything the app doesn't already compute elsewhere: it *reuses*
 * `calculateStatistics` (lib/statistics.ts) and `calculateTimelineStatistics`
 * (lib/timeline.ts) rather than re-deriving totals/date ranges/durations,
 * exactly per this sprint's "do not duplicate logic" instruction.
 *
 * `services/report/pdfGenerator.ts` is the only consumer of this module's
 * output — it turns a `ReportData` into a PDF and knows nothing about
 * Zustand or `EvtxEvent` shapes; this module is the only place report
 * *content* is decided, so presentation code never computes report data.
 */
import packageJson from "../../package.json";

import type {
  EvtxEvent,
  InvestigationSummary,
  RiskScore,
  SuspiciousFinding,
  UploadedFileMeta,
} from "@/types/evidence";
import type { CaseNote, EventNoteMap } from "@/lib/notes";
import type { BookmarkMap } from "@/lib/bookmarks";
import { calculateStatistics, formatDate, formatDateRange, formatDuration } from "@/lib/statistics";
import { calculateTimelineStatistics } from "@/lib/timeline";
import { formatFileSize } from "@/lib/utils";

export const REPORT_APP_VERSION: string = packageJson.version;

export interface ReportCoverInfo {
  caseFilename: string;
  generatedAt: Date;
  appVersion: string;
}

export interface ReportCaseInfo {
  filename: string;
  fileSizeLabel: string;
  totalEvents: number;
  uniqueProviders: number;
  uniqueComputers: number;
  uniqueEventIds: number;
  /** Span between the log's earliest and latest event — there's no separate
   * "investigation start/end" concept tracked anywhere in the app, so this
   * reuses the same log-duration calculation as the Dashboard's own
   * Statistics Cards ("Log Duration"). */
  investigationDuration: string;
}

export interface ReportExecutiveSummary {
  headline: string | null;
  narrative: string | null;
  keyFindings: string[];
  riskScore: RiskScore | null;
  suspiciousFindingsCount: number;
}

export interface ReportStatistics {
  totalEvents: number;
  uniqueProviders: number;
  uniqueComputers: number;
  uniqueEventIds: number;
  dateRange: string;
  logDuration: string;
}

export interface ReportTimelineSummary {
  earliestEvent: string;
  latestEvent: string;
  span: string;
}

export interface ReportBookmarkedEvent {
  timestamp: string;
  eventId: number;
  provider: string;
  level: string;
  computer: string;
  message: string;
}

export interface ReportEventNote {
  /** Context line identifying the bookmarked/noted event, or a fallback
   * when that event is no longer present in the currently loaded dataset
   * (notes persist in localStorage independently of the parsed events). */
  eventSummary: string;
  text: string;
  updatedAt: string;
}

export interface ReportNotes {
  caseNote: { text: string; updatedAt: string } | null;
  eventNotes: ReportEventNote[];
}

export interface ReportSuspiciousFinding {
  title: string;
  description: string;
  severity: SuspiciousFinding["severity"];
  mitreTechnique: string | null;
  eventSummary: string;
}

export interface ReportConclusion {
  riskScoreLabel: string;
  suspiciousEventCount: number;
  bookmarkCount: number;
  notesCount: number;
  timelineSpan: string;
}

export interface ReportData {
  cover: ReportCoverInfo;
  caseInfo: ReportCaseInfo;
  executiveSummary: ReportExecutiveSummary;
  statistics: ReportStatistics;
  timelineSummary: ReportTimelineSummary;
  bookmarkedEvents: ReportBookmarkedEvent[];
  notes: ReportNotes;
  suspiciousFindings: ReportSuspiciousFinding[];
  conclusion: ReportConclusion;
}

export interface BuildReportDataInput {
  uploadedFile: UploadedFileMeta;
  events: EvtxEvent[];
  investigationSummary: InvestigationSummary | null;
  suspiciousFindings: SuspiciousFinding[];
  caseNote: CaseNote | null;
  eventNotes: EventNoteMap;
  bookmarks: BookmarkMap;
}

function eventLabel(event: EvtxEvent | undefined, fallbackId: string): string {
  if (!event) return `Event ${fallbackId} (not present in the currently loaded dataset)`;
  return `Event ${event.eventId} — ${event.provider || "Unknown"} — ${formatDate(new Date(event.timestamp))}`;
}

/**
 * Assembles every section of the report from already-available
 * investigation data. Never throws: an empty case (`events: []`, no
 * summary, no bookmarks, no notes) produces a fully valid `ReportData`
 * with empty lists and "N/A"/null placeholders throughout, the same
 * "never throw on missing/empty data" contract every other `lib/*`
 * module in this project follows.
 */
export function buildReportData(input: BuildReportDataInput): ReportData {
  const { uploadedFile, events, investigationSummary, suspiciousFindings, caseNote, eventNotes, bookmarks } =
    input;

  const stats = calculateStatistics(events);
  const timeline = calculateTimelineStatistics(events, bookmarks, eventNotes);
  const eventById = new Map(events.map((event) => [event.id, event]));

  const bookmarkedEvents: ReportBookmarkedEvent[] = Object.keys(bookmarks)
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is EvtxEvent => Boolean(event))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((event) => ({
      timestamp: formatDate(new Date(event.timestamp)),
      eventId: event.eventId,
      provider: event.provider || "Unknown",
      level: event.level,
      computer: event.computer || "Unknown",
      message: event.message || "",
    }));

  const eventNoteEntries = Object.entries(eventNotes).sort(
    (a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime(),
  );
  const eventNoteRows: ReportEventNote[] = eventNoteEntries.map(([eventId, note]) => ({
    eventSummary: eventLabel(eventById.get(eventId), eventId),
    text: note.text,
    updatedAt: formatDate(new Date(note.updatedAt)),
  }));

  const suspiciousRows: ReportSuspiciousFinding[] = suspiciousFindings.map((finding) => ({
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    mitreTechnique: finding.mitreTechnique ?? null,
    eventSummary: eventLabel(eventById.get(finding.eventId), finding.eventId),
  }));

  const notesCount = eventNoteRows.length + (caseNote ? 1 : 0);

  return {
    cover: {
      caseFilename: uploadedFile.name,
      generatedAt: new Date(),
      appVersion: REPORT_APP_VERSION,
    },
    caseInfo: {
      filename: uploadedFile.name,
      fileSizeLabel: formatFileSize(uploadedFile.sizeBytes),
      totalEvents: stats.totalEvents,
      uniqueProviders: stats.uniqueProviders,
      uniqueComputers: stats.uniqueComputers,
      uniqueEventIds: stats.uniqueEventIds,
      investigationDuration: formatDuration(stats.earliestTimestamp, stats.latestTimestamp),
    },
    executiveSummary: {
      headline: investigationSummary?.headline ?? null,
      narrative: investigationSummary?.narrative ?? null,
      keyFindings: investigationSummary?.keyFindings ?? [],
      riskScore: investigationSummary?.riskScore ?? null,
      suspiciousFindingsCount: suspiciousFindings.length,
    },
    statistics: {
      totalEvents: stats.totalEvents,
      uniqueProviders: stats.uniqueProviders,
      uniqueComputers: stats.uniqueComputers,
      uniqueEventIds: stats.uniqueEventIds,
      dateRange: formatDateRange(stats.earliestTimestamp, stats.latestTimestamp),
      logDuration: formatDuration(stats.earliestTimestamp, stats.latestTimestamp),
    },
    timelineSummary: {
      earliestEvent: formatDate(stats.earliestTimestamp),
      latestEvent: formatDate(stats.latestTimestamp),
      span: timeline.spanDuration,
    },
    bookmarkedEvents,
    notes: {
      caseNote: caseNote ? { text: caseNote.text, updatedAt: formatDate(new Date(caseNote.updatedAt)) } : null,
      eventNotes: eventNoteRows,
    },
    suspiciousFindings: suspiciousRows,
    conclusion: {
      riskScoreLabel: investigationSummary
        ? `${investigationSummary.riskScore.score}/100 (${investigationSummary.riskScore.level})`
        : "N/A",
      suspiciousEventCount: suspiciousFindings.length,
      bookmarkCount: bookmarkedEvents.length,
      notesCount,
      timelineSpan: timeline.spanDuration,
    },
  };
}
