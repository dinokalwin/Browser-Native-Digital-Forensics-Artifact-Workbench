/**
 * Phase 2 (extension) — Automated Test Foundation. `serviceContext.ts` had
 * no coverage before this file. Includes explicit coverage of the
 * `serviceType` field (added alongside the kernel-mode-driver signal) and
 * the "SYSTEM" account classification `contextScoring.ts`'s
 * SYSTEM+untrusted-path combo signal depends on.
 */
import { describe, expect, it } from "vitest";
import {
  analyzeServiceContext,
  classifyServiceAccount,
  parseEventDataMessage,
} from "../serviceContext";

function buildMessage(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([name, value]) => `${name}: ${value}`)
    .join(" | ");
}

describe("parseEventDataMessage", () => {
  it("inverts the 'Name: Value | Name: Value' fallback-message format", () => {
    const fields = parseEventDataMessage(
      "ServiceName: TestSvc | ImagePath: C:\\Windows\\System32\\test.exe",
    );
    expect(fields.get("ServiceName")).toBe("TestSvc");
    expect(fields.get("ImagePath")).toBe("C:\\Windows\\System32\\test.exe");
  });

  it("splits only on the FIRST ': ' within a segment, tolerating values that contain ': '", () => {
    const fields = parseEventDataMessage("StartTime: 2026-01-01T00:00:00Z: extra");
    expect(fields.get("StartTime")).toBe("2026-01-01T00:00:00Z: extra");
  });

  it("returns an empty map for null/empty/unrecognizable input", () => {
    expect(parseEventDataMessage(null).size).toBe(0);
    expect(parseEventDataMessage("").size).toBe(0);
    expect(parseEventDataMessage("no colon here").size).toBe(0);
  });
});

describe("classifyServiceAccount", () => {
  it("classifies SYSTEM in both its forms", () => {
    expect(classifyServiceAccount("LocalSystem")).toBe("system");
    expect(classifyServiceAccount("NT AUTHORITY\\SYSTEM")).toBe("system");
    expect(classifyServiceAccount("system")).toBe("system");
  });

  it("classifies Network Service and Local Service", () => {
    expect(classifyServiceAccount("NT AUTHORITY\\NetworkService")).toBe("network-service");
    expect(classifyServiceAccount("NT AUTHORITY\\LocalService")).toBe("local-service");
  });

  it("classifies a domain\\user account as 'user'", () => {
    expect(classifyServiceAccount("DOMAIN\\jsmith")).toBe("user");
  });

  it("classifies missing/empty account as 'unknown'", () => {
    expect(classifyServiceAccount(null)).toBe("unknown");
    expect(classifyServiceAccount("")).toBe("unknown");
  });
});

describe("analyzeServiceContext", () => {
  it("extracts every field, classifies the path, and matches a vendor", () => {
    const message = buildMessage({
      ServiceName: "MicrosoftUpdateSvc",
      DisplayName: "Microsoft Update Service",
      ImagePath: "C:\\Windows\\System32\\muupdate.exe",
      AccountName: "LocalSystem",
      StartType: "auto start",
      ServiceType: "user mode service",
    });
    const ctx = analyzeServiceContext(message);

    expect(ctx.serviceName).toBe("MicrosoftUpdateSvc");
    expect(ctx.displayName).toBe("Microsoft Update Service");
    expect(ctx.imagePath).toBe("C:\\Windows\\System32\\muupdate.exe");
    expect(ctx.accountClass).toBe("system");
    expect(ctx.startType).toBe("auto start");
    expect(ctx.serviceType).toBe("user mode service");
    expect(ctx.pathClassification.classification).toBe("trusted-system");
    expect(ctx.vendorMatch.matched).toBe(true);
    expect(ctx.vendorMatch.vendor).toBe("microsoft");
    expect(ctx.unusualName).toBe(false);
  });

  it("regression: extracts a kernel-mode ServiceType field distinctly", () => {
    const message = buildMessage({
      ServiceName: "wdfilter",
      ImagePath: "C:\\Windows\\System32\\drivers\\wd\\WdFilter.sys",
      ServiceType: "kernel mode driver",
    });
    const ctx = analyzeServiceContext(message);
    expect(ctx.serviceType).toBe("kernel mode driver");
  });

  it("flags a machine-generated service name as unusual", () => {
    const message = buildMessage({
      ServiceName: "a1b2c3d4e5f6a7b8",
      ImagePath: "C:\\Temp\\svc.exe",
    });
    const ctx = analyzeServiceContext(message);
    expect(ctx.unusualName).toBe(true);
  });

  it("falls back to displayName for the unusual-name check when serviceName is absent", () => {
    const message = buildMessage({ DisplayName: "xkqzmwvpblkxjh" });
    const ctx = analyzeServiceContext(message);
    expect(ctx.unusualName).toBe(true);
  });

  it("falls back to ServiceFileName/ImageName when ImagePath is absent (4697 shape)", () => {
    const ctx = analyzeServiceContext(
      buildMessage({ ServiceFileName: "C:\\Program Files\\App\\app.exe" }),
    );
    expect(ctx.imagePath).toBe("C:\\Program Files\\App\\app.exe");
    expect(ctx.pathClassification.classification).toBe("trusted-application");
  });

  it("never throws on a message with no recognizable fields, returning a fully-null context", () => {
    const ctx = analyzeServiceContext("this is not a structured event message");
    expect(ctx.serviceName).toBeNull();
    expect(ctx.imagePath).toBeNull();
    expect(ctx.serviceType).toBeNull();
    expect(ctx.pathClassification.classification).toBe("unknown");
    expect(ctx.vendorMatch.matched).toBe(false);
    expect(ctx.unusualName).toBe(false);
    expect(ctx.accountClass).toBe("unknown");
  });

  it("never throws on null/empty message", () => {
    expect(() => analyzeServiceContext(null)).not.toThrow();
    expect(() => analyzeServiceContext("")).not.toThrow();
  });
});
