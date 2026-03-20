import { describe, expect, it } from "vitest";
import { getDefaultVersion } from "../../src/utils/getDefaultVersion.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VERSION_A = {
  versionKey: { system: "NPM", name: "express", version: "4.18.2" },
  publishedAt: "2022-10-08T00:00:00Z",
  isDefault: false,
};

const VERSION_B = {
  versionKey: { system: "NPM", name: "express", version: "5.2.1" },
  publishedAt: "2025-12-01T00:00:00Z",
  isDefault: true,
};

const VERSION_C = {
  versionKey: { system: "NPM", name: "express", version: "5.3.0" },
  publishedAt: "2026-01-15T00:00:00Z",
  isDefault: false,
};

// ---------------------------------------------------------------------------
// getDefaultVersion
// ---------------------------------------------------------------------------

describe("getDefaultVersion", () => {
  it("returns the version with isDefault: true", () => {
    const result = getDefaultVersion([VERSION_A, VERSION_B, VERSION_C]);
    expect(result).toBe(VERSION_B);
    expect(result?.versionKey.version).toBe("5.2.1");
  });

  it("falls back to the last version when none has isDefault", () => {
    const versions = [
      { ...VERSION_A, isDefault: false },
      { ...VERSION_C, isDefault: false },
    ];
    const result = getDefaultVersion(versions);
    expect(result?.versionKey.version).toBe("5.3.0");
  });

  it("returns undefined for an empty array", () => {
    const result = getDefaultVersion([] as typeof VERSION_A[]);
    expect(result).toBeUndefined();
  });

  it("returns the only version when array has one element", () => {
    const result = getDefaultVersion([VERSION_A]);
    expect(result?.versionKey.version).toBe("4.18.2");
  });

  it("returns the first isDefault if multiple are marked", () => {
    const versions = [
      { ...VERSION_A, isDefault: true },
      { ...VERSION_B, isDefault: true },
    ];
    const result = getDefaultVersion(versions);
    expect(result?.versionKey.version).toBe("4.18.2");
  });
});
