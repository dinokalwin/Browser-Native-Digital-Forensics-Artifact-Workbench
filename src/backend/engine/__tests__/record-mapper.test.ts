/**
 * Phase 2 — Automated Test Foundation (SDD §24 item 1, record-mapping
 * portion). Exercises `xmlToEvent` directly against crafted XML + a stub
 * `EvtxRecordLike` (the 3-method interface this module actually depends
 * on: `recordNum()`, `renderXml()`, `timestampAsDate()`) — no real EVTX
 * binary fixture is needed here, since `xmlToEvent`'s own contract starts
 * from already-rendered XML text.
 */
import { describe, expect, it } from "vitest";
import { xmlToEvent } from "../record-mapper";

interface StubRecord {
  recordNum(): bigint;
  renderXml(): string;
  timestampAsDate(): Date;
}

function stubRecord(overrides: Partial<StubRecord> = {}): StubRecord {
  return {
    recordNum: () => 42n,
    renderXml: () => "<Event/>",
    timestampAsDate: () => new Date("2026-01-01T12:00:00.000Z"),
    ...overrides,
  };
}

const WELL_FORMED_XML = `
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

describe("xmlToEvent", () => {
  it("maps a well-formed record's System/EventData fields correctly", () => {
    const event = xmlToEvent(stubRecord({ renderXml: () => WELL_FORMED_XML }));
    expect(event).not.toBeNull();
    expect(event?.eventId).toBe(4624);
    expect(event?.provider).toBe("Microsoft-Windows-Security-Auditing");
    expect(event?.computer).toBe("WORKSTATION1");
    expect(event?.channel).toBe("Security");
    expect(event?.level).toBe("Information");
    expect(event?.id).toBe("evt-42");
    expect(event?.message).toContain("TargetUserName: jsmith");
    expect(event?.message).toContain("LogonType: 10");
  });

  it("resolves `user` from the first user-friendly EventData field in document order", () => {
    const event = xmlToEvent(stubRecord({ renderXml: () => WELL_FORMED_XML }));
    expect(event?.user).toBe("jsmith");
  });

  it(
    "populates `raw.xml` with the exact rendered XML for drill-down (Phase 5 Item 1), " +
      "verbatim and alongside correctly-mapped sibling fields",
    () => {
      const event = xmlToEvent(stubRecord({ renderXml: () => WELL_FORMED_XML }));
      // Verbatim, not reformatted/trimmed/re-serialized — `xmlToEvent` must
      // preserve exactly what `record.renderXml()` produced (the source
      // that's already indented by `@ts-evtx/core`'s own template renderer),
      // since this is meant to be forensic evidence, not a derived summary.
      expect(event?.raw).toEqual({ xml: WELL_FORMED_XML });
      // Adding `raw` must not disturb any other field this same call maps.
      expect(event?.eventId).toBe(4624);
      expect(event?.provider).toBe("Microsoft-Windows-Security-Auditing");
    },
  );

  it("falls back to the Security UserID when no user-friendly field is present", () => {
    const xml = `
<Event><System>
  <Provider Name="Test"/><EventID>4688</EventID><Level>4</Level>
  <TimeCreated SystemTime="2026-01-01T12:00:00.000000000Z"/>
  <Computer>HOST1</Computer><Security UserID="S-1-5-18"/><Channel>Security</Channel>
</System></Event>`;
    const event = xmlToEvent(stubRecord({ renderXml: () => xml }));
    expect(event?.user).toBe("S-1-5-18");
  });

  it('falls back to "N/A" when neither a user-friendly field nor a Security UserID is present', () => {
    const xml = `
<Event><System>
  <Provider Name="Test"/><EventID>1102</EventID><Level>4</Level>
  <TimeCreated SystemTime="2026-01-01T12:00:00.000000000Z"/>
  <Computer>HOST1</Computer><Channel>Security</Channel>
</System></Event>`;
    const event = xmlToEvent(stubRecord({ renderXml: () => xml }));
    expect(event?.user).toBe("N/A");
  });

  it("uses UserData as a fallback data scope when EventData is absent", () => {
    const xml = `
<Event><System>
  <Provider Name="Test"/><EventID>4698</EventID><Level>4</Level>
  <TimeCreated SystemTime="2026-01-01T12:00:00.000000000Z"/>
  <Computer>HOST1</Computer><Channel>Microsoft-Windows-TaskScheduler/Operational</Channel>
</System>
<UserData><Data Name="TaskName">EvilTask</Data></UserData></Event>`;
    const event = xmlToEvent(stubRecord({ renderXml: () => xml }));
    expect(event?.message).toContain("TaskName: EvilTask");
  });

  it("returns null when renderXml() throws (unrecoverable BinXML record)", () => {
    const event = xmlToEvent(
      stubRecord({
        renderXml: () => {
          throw new Error("BinXML template decode failure");
        },
      }),
    );
    expect(event).toBeNull();
  });

  it("returns null for structurally invalid XML", () => {
    const event = xmlToEvent(
      stubRecord({ renderXml: () => "<Event><System><EventID>4624</EventID>" }),
    );
    expect(event).toBeNull();
  });

  it("returns null when no <System> element is present", () => {
    const event = xmlToEvent(stubRecord({ renderXml: () => "<Event><NotSystem/></Event>" }));
    expect(event).toBeNull();
  });

  it("never fabricates a date for a corrupt timestamp — falls back to the raw SystemTime string", () => {
    const xml = `
<Event><System>
  <Provider Name="Test"/><EventID>4624</EventID><Level>0</Level>
  <TimeCreated SystemTime="2026-06-15T09:30:00.000000000Z"/>
  <Computer>HOST1</Computer><Channel>Security</Channel>
</System></Event>`;
    const event = xmlToEvent(
      stubRecord({
        renderXml: () => xml,
        timestampAsDate: () => {
          throw new Error("Corrupt FILETIME value");
        },
      }),
    );
    expect(event?.timestamp).toBe("2026-06-15T09:30:00.000000000Z");
  });

  it("never fabricates a date when timestampAsDate() returns an Invalid Date and no SystemTime attribute exists either — falls back to an empty string, not the Unix epoch", () => {
    const xml = `
<Event><System>
  <Provider Name="Test"/><EventID>4624</EventID><Level>0</Level>
  <Computer>HOST1</Computer><Channel>Security</Channel>
</System></Event>`;
    const event = xmlToEvent(
      stubRecord({
        renderXml: () => xml,
        timestampAsDate: () => new Date(NaN),
      }),
    );
    expect(event?.timestamp).toBe("");
    expect(event?.timestamp).not.toBe(new Date(0).toISOString());
  });

  it("defaults an unrecognized Level to Information rather than throwing", () => {
    const xml = `
<Event><System>
  <Provider Name="Test"/><EventID>4624</EventID><Level>99</Level>
  <TimeCreated SystemTime="2026-01-01T12:00:00.000000000Z"/>
  <Computer>HOST1</Computer><Channel>Security</Channel>
</System></Event>`;
    const event = xmlToEvent(stubRecord({ renderXml: () => xml }));
    expect(event?.level).toBe("Information");
  });
});
