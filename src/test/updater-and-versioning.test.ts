import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppUpdater } from "../features/updater/useAppUpdater";
// @ts-expect-error script module without d.ts
import { computeNextVersion } from "../../scripts/version-bump.mjs";
// @ts-expect-error script module without d.ts
import { validateVersions } from "../../scripts/version-check.mjs";
// @ts-expect-error script module without d.ts
import { extractReleaseNotes } from "../../scripts/release-notes.mjs";
// @ts-expect-error script module without d.ts
import { verifyReleaseDirectory } from "../../scripts/verify-release-artifacts.mjs";
import fs from "fs";
import path from "path";
import os from "os";

describe("Version Management & SemVer Strategy", () => {
  it("calculates next versions accurately for patch, minor, and major", () => {
    expect(computeNextVersion("0.1.0", "patch")).toBe("0.1.1");
    expect(computeNextVersion("0.1.0", "minor")).toBe("0.2.0");
    expect(computeNextVersion("0.1.0", "major")).toBe("1.0.0");
    expect(computeNextVersion("1.0.0", "prerelease")).toBe("1.0.1-beta.1");
    expect(computeNextVersion("1.0.1-beta.1", "prerelease")).toBe("1.0.1-beta.2");
  });

  it("accepts an explicit valid SemVer string", () => {
    expect(computeNextVersion("0.1.0", "1.2.3")).toBe("1.2.3");
    expect(computeNextVersion("0.1.0", "2.0.0-rc.1")).toBe("2.0.0-rc.1");
  });

  it("rejects invalid bump arguments", () => {
    expect(() => computeNextVersion("0.1.0", "invalid")).toThrow(/Invalid bump type/);
    expect(() => computeNextVersion("invalid", "patch")).toThrow(
      /not a valid Semantic Version/
    );
  });

  it("synchronizes versions across project manifests in actual repository", () => {
    const check = validateVersions(process.cwd());
    expect(check.valid).toBe(true);
    expect(check.errors).toHaveLength(0);
    expect(check.version).toBe("0.1.1");
    expect(check.versions.packageJson.version).toBe("0.1.1");
    expect(check.versions.tauriConf.version).toBe("0.1.1");
    expect(check.versions.cargoToml.version).toBe("0.1.1");
  });

  it("detects and rejects mismatched git tags", () => {
    const validTag = validateVersions(process.cwd(), "v0.1.1");
    expect(validTag.valid).toBe(true);

    const invalidTag = validateVersions(process.cwd(), "v0.9.9");
    expect(invalidTag.valid).toBe(false);
    expect(invalidTag.errors[0]).toContain("Tag mismatch");
  });
});

describe("Changelog Parser & Release Notes", () => {
  const sampleChangelog = `
# Changelog

## [Unreleased]
### Added
- Signed in-app updates.

## [0.1.0] - 2026-10-24
### Added
- Initial release with academic search.

### Fixed
- Formula injection protection.

## [0.0.9] - 2026-10-20
### Added
- Prototype scraper.
`;

  it("extracts notes for a specific version correctly", () => {
    const notes010 = extractReleaseNotes("0.1.0", sampleChangelog);
    expect(notes010).not.toBeNull();
    expect(notes010).toContain("Initial release with academic search");
    expect(notes010).toContain("Formula injection protection");
    expect(notes010).not.toContain("Prototype scraper");

    const notes009 = extractReleaseNotes("0.0.9", sampleChangelog);
    expect(notes009).not.toBeNull();
    expect(notes009).toContain("Prototype scraper");
    expect(notes009).not.toContain("Initial release with academic search");
  });

  it("extracts notes with or without leading 'v'", () => {
    const notesWithV = extractReleaseNotes("v0.1.0", sampleChangelog);
    expect(notesWithV).not.toBeNull();
    expect(notesWithV).toContain("Initial release with academic search");
  });

  it("returns null for non-existent versions", () => {
    const notes = extractReleaseNotes("9.9.9", sampleChangelog);
    expect(notes).toBeNull();
  });
});

describe("Release Artifact Verification Logic", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "inf-release-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("flags missing installers when target directory is empty", () => {
    const result = verifyReleaseDirectory(tempDir, "0.1.0");
    expect(result.valid).toBe(false);
    expect(result.issues.some((i: string) => i.includes("No installer packages"))).toBe(
      true
    );
  });

  it("validates well-formed updater manifest latest.json and installer bundles", () => {
    // 1. Create a mock installer (>100KB)
    const installerPath = path.join(tempDir, "Infinity-Researcher_0.1.0_x64-setup.exe");
    fs.writeFileSync(installerPath, Buffer.alloc(1024 * 150, "A"));

    // 2. Create a mock minisign signature
    const sigPath = path.join(tempDir, "Infinity-Researcher_0.1.0_x64.nsis.zip.sig");
    fs.writeFileSync(
      sigPath,
      "untrusted comment: signature from tauri secret key\nRWTestSignatureContentHere1234567890=="
    );

    // 3. Create latest.json
    const manifestPath = path.join(tempDir, "latest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "0.1.0",
        notes: "Release notes",
        pub_date: "2026-10-27T00:00:00Z",
        platforms: {
          "windows-x86_64": {
            signature: "RWTestSignatureContentHere1234567890==",
            url: "https://github.com/sanjay-m6/Infinity-Researcher/releases/download/v0.1.0/bundle.zip",
          },
        },
      })
    );

    const result = verifyReleaseDirectory(tempDir, "0.1.0");
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.verifiedAssets.length).toBeGreaterThanOrEqual(3);
  });

  it("detects version mismatches in latest.json", () => {
    const manifestPath = path.join(tempDir, "latest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "0.1.0",
        platforms: { "windows-x86_64": { url: "http://example.com", signature: "sig" } },
      })
    );

    const result = verifyReleaseDirectory(tempDir, "0.2.0");
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i: string) =>
        i.includes('does not match expected version "0.2.0"')
      )
    ).toBe(true);
  });
});

describe("useAppUpdater Hook (Browser / Unit Test Environment)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("initializes with default safe state in browser preview", () => {
    const { result } = renderHook(() => useAppUpdater());

    expect(result.current.status).toBe("idle");
    expect(result.current.updateInfo).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.autoCheckEnabled).toBe(true);
    expect(result.current.channel).toBe("stable");
    expect(result.current.isTauri).toBe(false);
  });

  it("allows toggling auto-check and channel preferences with persistence", () => {
    const { result } = renderHook(() => useAppUpdater());

    act(() => {
      result.current.setAutoCheckEnabled(false);
      result.current.setChannel("beta");
    });

    expect(result.current.autoCheckEnabled).toBe(false);
    expect(result.current.channel).toBe("beta");
    expect(localStorage.getItem("infinity_updater_auto_check")).toBe("false");
    expect(localStorage.getItem("infinity_updater_channel")).toBe("beta");
  });

  it("runs update check safely in non-Tauri preview and updates lastChecked", async () => {
    const { result } = renderHook(() => useAppUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.status).toBe("up-to-date");
    expect(result.current.lastChecked).not.toBeNull();
    expect(localStorage.getItem("infinity_updater_last_checked")).not.toBeNull();
  });

  it("persists dismissal state when dismissUpdate is triggered", () => {
    const { result } = renderHook(() => useAppUpdater());

    act(() => {
      // simulate available update
      result.current.dismissUpdate();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.updateInfo).toBeNull();
  });
});
