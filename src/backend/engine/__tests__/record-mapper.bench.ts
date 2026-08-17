/**
 * Phase 4 — Performance at Scale. Benchmarks `record-mapper.ts#xmlToEvent`
 * — the one piece of the real per-record parsing path that's actual
 * CPU-bound, project-owned work (`fast-xml-parser`'s XML→object mapping
 * plus this module's own field extraction), independent of
 * `parseEVTXBuffer`'s mocked-generator loop overhead measured separately
 * in `parser.bench.ts`. No mocking here at all: `xmlToEvent` is called
 * directly against representative XML text, exactly as `record-mapper.
 * test.ts` (Phase 2) already does, so this is a real, unmodified
 * measurement of the actual mapping code.
 *
 * Run via `npm run bench` (`vitest bench`) — see `parser.bench.ts`'s doc
 * comment for why this file has no effect on `npm run test`'s 185-test
 * baseline.
 */
import { bench, describe } from "vitest";
import { xmlToEvent } from "../record-mapper";

interface StubRecord {
  recordNum(): bigint;
  renderXml(): string;
  timestampAsDate(): Date;
}

/** Representative of a real Security-log logon event — same shape as
 * record-mapper.test.ts's WELL_FORMED_XML fixture: a realistic System
 * block plus a couple of EventData fields, not a trivial `<Event/>`. */
const REPRESENTATIVE_XML = `
<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
  <System>
    <Provider Name="Microsoft-Windows-Security-Auditing" Guid="{54849625-5478-4994-a5ba-3e3b0328c30d}"/>
    <EventID>4624</EventID>
    <Level>0</Level>
    <TimeCreated SystemTime="2026-01-01T12:00:00.000000000Z"/>
    <Computer>WORKSTATION1</Computer>
    <Security UserID="S-1-5-18"/>
    <Channel>Security</Channel>
  </System>
  <EventData>
    <Data Name="TargetUserName">jsmith</Data>
    <Data Name="LogonType">10</Data>
  </EventData>
</Event>`;

let recordCounter = 0;
function stubRecord(): StubRecord {
  recordCounter += 1;
  return {
    recordNum: () => BigInt(recordCounter),
    renderXml: () => REPRESENTATIVE_XML,
    timestampAsDate: () => new Date("2026-01-01T12:00:00.000Z"),
  };
}

describe("xmlToEvent throughput (representative Security-log record XML)", () => {
  bench("single record mapping", () => {
    xmlToEvent(stubRecord());
  });
});
