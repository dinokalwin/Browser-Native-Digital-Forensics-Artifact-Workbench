/**
 * Phase 2 (extension) — Automated Test Foundation. `vendorContext.ts` had
 * no coverage before this file. Includes a regression test for the
 * `"brave"` fragment found (undocumented, but confirmed genuinely present
 * and correctly wired) during this session's repository verification.
 */
import { describe, expect, it } from "vitest";
import { looksLikeRandomIdentifier, matchKnownVendor } from "../vendorContext";

describe("matchKnownVendor", () => {
  it("matches a known vendor fragment case-insensitively", () => {
    const result = matchKnownVendor([{ text: "Microsoft Update Service", source: "service-name" }]);
    expect(result.matched).toBe(true);
    expect(result.vendor).toBe("microsoft");
    expect(result.source).toBe("service-name");
  });

  it("regression: matches the 'brave' vendor fragment", () => {
    const result = matchKnownVendor([
      { text: "Brave Update Service (brave)", source: "service-name" },
    ]);
    expect(result.matched).toBe(true);
    expect(result.vendor).toBe("brave");
  });

  it("checks candidates in order and returns the first hit", () => {
    const result = matchKnownVendor([
      { text: "Totally Custom Name", source: "service-name" },
      { text: "Google Chrome Updater", source: "display-name" },
    ]);
    expect(result.matched).toBe(true);
    expect(result.source).toBe("display-name");
  });

  it("returns no match when nothing in KNOWN_VENDOR_FRAGMENTS is present", () => {
    const result = matchKnownVendor([{ text: "TotallyUnknownThing123", source: "service-name" }]);
    expect(result).toEqual({ matched: false, vendor: null, source: null });
  });

  it("skips null/undefined/empty candidates without throwing", () => {
    const result = matchKnownVendor([
      { text: null, source: "service-name" },
      { text: undefined, source: "display-name" },
      { text: "", source: "image-path" },
      { text: "Realtek Audio Driver", source: "other" },
    ]);
    expect(result.matched).toBe(true);
    expect(result.vendor).toBe("realtek");
  });

  it("returns no match for an empty candidate list", () => {
    expect(matchKnownVendor([])).toEqual({ matched: false, vendor: null, source: null });
  });
});

describe("looksLikeRandomIdentifier", () => {
  it("flags a canonical GUID as machine-generated", () => {
    expect(looksLikeRandomIdentifier("{4d36e972-e325-11ce-bfc1-08002be10318}")).toBe(true);
  });

  it("flags a long hex-only run as machine-generated", () => {
    expect(looksLikeRandomIdentifier("a1b2c3d4e5f6a7b8c9d0")).toBe(true);
  });

  it("flags a long, mostly-digit token as machine-generated", () => {
    expect(looksLikeRandomIdentifier("svc_48291037462")).toBe(true);
  });

  it("flags a long consonant-only run with no vowels as machine-generated", () => {
    expect(looksLikeRandomIdentifier("xkqzmwvpblkxjh")).toBe(true);
  });

  it("does not flag an ordinary human-chosen service name", () => {
    expect(looksLikeRandomIdentifier("Windows Update Service")).toBe(false);
    expect(looksLikeRandomIdentifier("ProtonVPN Service")).toBe(false);
  });

  it("does not flag short names, even if they look terse", () => {
    expect(looksLikeRandomIdentifier("wuauserv")).toBe(false); // 8 chars but has vowels/isn't all-digit
  });

  it("returns false for null/undefined/empty input", () => {
    expect(looksLikeRandomIdentifier(null)).toBe(false);
    expect(looksLikeRandomIdentifier(undefined)).toBe(false);
    expect(looksLikeRandomIdentifier("")).toBe(false);
  });

  it("does not flag a normal name just because it happens to be long", () => {
    expect(looksLikeRandomIdentifier("Google Chrome Elevation Service")).toBe(false);
  });
});
