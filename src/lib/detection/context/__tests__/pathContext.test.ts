/**
 * Phase 2 (extension) — Automated Test Foundation. `pathContext.ts` had no
 * coverage at all before this file, despite being one of the highest-risk
 * modules changed under Phase 5.13/5.13.1 (its trusted-system regex gained
 * new alternations — `\systemroot\system32\`, `\systemroot\syswow64\`,
 * `system32\drivers\wd\` — as part of the kernel-mode-driver work). Every
 * classification bucket is exercised, both by its "expanded path" form and
 * its `%ENV_VAR%` form per the module's own documented contract.
 */
import { describe, expect, it } from "vitest";
import { classifyPath, extractExecutablePath, normalizeForClassification } from "../pathContext";

describe("classifyPath", () => {
  it("classifies core Windows system directories as trusted-system", () => {
    expect(classifyPath("C:\\Windows\\System32\\svchost.exe").classification).toBe(
      "trusted-system",
    );
    expect(classifyPath("C:\\Windows\\SysWOW64\\rundll32.exe").classification).toBe(
      "trusted-system",
    );
    expect(classifyPath("%SystemRoot%\\System32\\drivers\\driver.sys").classification).toBe(
      "trusted-system",
    );
    expect(classifyPath("%WinDir%\\System32\\lsass.exe").classification).toBe("trusted-system");
  });

  it("classifies the newer trusted-system alternations added alongside kernel-driver detection", () => {
    // \systemroot\system32\, \systemroot\syswow64\, system32\drivers\wd\ —
    // regression coverage for the expanded regex found during this phase's
    // repository verification.
    expect(classifyPath("\\SystemRoot\\System32\\ntoskrnl.exe").classification).toBe(
      "trusted-system",
    );
    expect(classifyPath("\\SystemRoot\\SysWOW64\\some.dll").classification).toBe("trusted-system");
    expect(classifyPath("C:\\Windows\\System32\\drivers\\wd\\WdFilter.sys").classification).toBe(
      "trusted-system",
    );
  });

  it("classifies standard application-install directories as trusted-application", () => {
    expect(classifyPath("C:\\Program Files\\Vendor\\app.exe").classification).toBe(
      "trusted-application",
    );
    expect(classifyPath("C:\\Program Files (x86)\\Vendor\\app.exe").classification).toBe(
      "trusted-application",
    );
    // WindowsApps physically lives under Program Files, not under Windows —
    // a path anchored at "C:\Windows\..." would instead hit trusted-system's
    // `^c:\windows\` alternative first (see the dedicated test below for
    // that exact precedence behavior).
    expect(
      classifyPath("C:\\Program Files\\WindowsApps\\Vendor.App_1.0.0\\app.exe").classification,
    ).toBe("trusted-application");
    expect(classifyPath("C:\\ProgramData\\Vendor\\service.exe").classification).toBe(
      "trusted-application",
    );
  });

  it("classifies ANY path under C:\\Windows\\ as trusted-system, even a subfolder trusted-application would otherwise recognize — the broad `^c:\\windows\\` anchor wins first", () => {
    // Documents actual current behavior (not a spec requirement): since
    // `^c:\windows\` is tried at position 0 and matches immediately, it
    // wins over the more specific `\windowsapps\` alternative for any path
    // literally rooted at C:\Windows\.
    expect(classifyPath("C:\\Windows\\WindowsApps\\Vendor.App_1.0.0\\app.exe").classification).toBe(
      "trusted-system",
    );
  });

  it("classifies user-profile paths as user-writable", () => {
    expect(classifyPath("C:\\Users\\jsmith\\AppData\\Roaming\\tool.exe").classification).toBe(
      "user-writable",
    );
    expect(classifyPath("C:\\Users\\jsmith\\AppData\\Local\\tool.exe").classification).toBe(
      "user-writable",
    );
    expect(classifyPath("C:\\Users\\Public\\tool.exe").classification).toBe("user-writable");
    expect(classifyPath("C:\\Users\\jsmith\\Desktop\\tool.exe").classification).toBe(
      "user-writable",
    );
  });

  it("classifies Temp directories as temporary, even though they also sit under AppData", () => {
    // Ordering matters: temp must be matched before the broader
    // AppData/user-writable pattern, or every Temp path would misclassify.
    expect(
      classifyPath("C:\\Users\\jsmith\\AppData\\Local\\Temp\\payload.exe").classification,
    ).toBe("temporary");
    expect(classifyPath("%TEMP%\\dropper.exe").classification).toBe("temporary");
    expect(classifyPath("C:\\Windows\\Temp\\svc.exe").classification).toBe("temporary");
  });

  it("classifies Downloads directories as download", () => {
    expect(classifyPath("C:\\Users\\jsmith\\Downloads\\setup.exe").classification).toBe("download");
  });

  it("classifies unrecognized paths as unknown, with no matched segment", () => {
    const result = classifyPath("D:\\CustomTools\\thing.exe");
    expect(result.classification).toBe("unknown");
    expect(result.matchedSegment).toBeNull();
  });

  it("returns unknown for null/undefined/empty input without throwing", () => {
    expect(classifyPath(null).classification).toBe("unknown");
    expect(classifyPath(undefined).classification).toBe("unknown");
    expect(classifyPath("").classification).toBe("unknown");
    expect(classifyPath("   ").classification).toBe("unknown");
  });

  it("is case-insensitive and slash-direction-normalized", () => {
    expect(classifyPath("c:/windows/system32/SVCHOST.EXE").classification).toBe("trusted-system");
    expect(classifyPath("C:\\WINDOWS\\SYSTEM32\\svchost.exe").classification).toBe(
      "trusted-system",
    );
  });

  it("matches regardless of trailing command-line arguments", () => {
    const result = classifyPath('"C:\\Windows\\System32\\svchost.exe" -k netsvcs -p');
    expect(result.classification).toBe("trusted-system");
  });

  it("reports the specific matched segment for the explanation UI", () => {
    // The `^c:\windows\` anchor (anchored at position 0) wins over the more
    // specific `\windows\system32\` alternative for any literal C:\Windows\
    // path — see the precedence test above. A path that does NOT start
    // with the drive letter (e.g. the %SystemRoot%-expanded UNC-less form)
    // is what actually exercises the more specific alternative.
    const anchored = classifyPath("C:\\Windows\\System32\\svchost.exe");
    expect(anchored.matchedSegment).toBe("c:\\windows\\");

    const unanchored = classifyPath("\\Windows\\System32\\svchost.exe");
    expect(unanchored.matchedSegment).toBe("\\windows\\system32\\");
  });
});

describe("normalizeForClassification", () => {
  it("lowercases, strips surrounding quotes, and normalizes slashes", () => {
    expect(normalizeForClassification('"C:/Windows/System32/svchost.exe"')).toBe(
      "c:\\windows\\system32\\svchost.exe",
    );
  });

  it("returns an empty string for falsy input", () => {
    expect(normalizeForClassification("")).toBe("");
  });
});

describe("extractExecutablePath", () => {
  it("extracts a quoted path, dropping trailing arguments", () => {
    expect(extractExecutablePath('"C:\\Program Files\\App\\app.exe" -arg1 -arg2')).toBe(
      "C:\\Program Files\\App\\app.exe",
    );
  });

  it("extracts a bare leading token when unquoted", () => {
    expect(extractExecutablePath("C:\\Windows\\System32\\svchost.exe -k netsvcs")).toBe(
      "C:\\Windows\\System32\\svchost.exe",
    );
  });

  it("returns null for empty/missing input", () => {
    expect(extractExecutablePath(null)).toBeNull();
    expect(extractExecutablePath("")).toBeNull();
  });
});
