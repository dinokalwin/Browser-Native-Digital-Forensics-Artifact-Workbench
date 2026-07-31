/**
 * Client-side CSV export. No library needed — CSV is simple enough to
 * generate correctly by hand as long as fields are escaped properly
 * (quote any field containing a comma, quote, or newline; double up
 * internal quotes). Runs entirely in the browser, produces a Blob for
 * the caller to trigger a download from.
 */
import type { EvtxEvent } from "@/types/evidence";

const COLUMNS: Array<{ key: keyof EvtxEvent; header: string }> = [
  { key: "timestamp", header: "Timestamp" },
  { key: "eventId", header: "Event ID" },
  { key: "level", header: "Level" },
  { key: "provider", header: "Provider" },
  { key: "computer", header: "Computer" },
  { key: "user", header: "User" },
  { key: "channel", header: "Channel" },
  { key: "message", header: "Message" },
];

/**
 * Neutralizes CSV/formula injection (CWE-1236): if a cell's text starts
 * with a character Excel/Sheets/LibreOffice treats as a formula trigger
 * (=, +, -, @, or tab/CR), a spreadsheet application executes it as a
 * formula on open rather than displaying it as text. This is a real
 * attack path here specifically: `user`, `message`, `provider`, and
 * `computer` all originate from a Windows event log that may have been
 * written by an attacker-controlled or compromised host (e.g. a crafted
 * TargetUserName in a 4720 account-creation event), and the exported CSV
 * is later opened by a SOC analyst in Excel. Prefixing with a single
 * quote is the standard OWASP-recommended mitigation — spreadsheet
 * applications treat a leading `'` as "force text", neutralizing the
 * formula without visibly altering the data for a human reader.
 */
function neutralizeFormulaInjection(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvField(value: unknown): string {
  const str =
    value === null || value === undefined ? "" : neutralizeFormulaInjection(String(value));
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function eventsToCSV(events: EvtxEvent[]): string {
  const header = COLUMNS.map((c) => escapeCsvField(c.header)).join(",");
  const rows = events.map((event) => COLUMNS.map((c) => escapeCsvField(event[c.key])).join(","));
  return [header, ...rows].join("\r\n");
}

export function exportEventsAsCSV(events: EvtxEvent[]): Blob {
  // Leading BOM so Excel reliably detects UTF-8 instead of guessing wrong.
  return new Blob(["﻿" + eventsToCSV(events)], { type: "text/csv;charset=utf-8;" });
}
