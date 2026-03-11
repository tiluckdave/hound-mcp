import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OsvError,
  extractCvssScore,
  extractFixVersions,
  extractSeverity,
  getVuln,
  queryVulns,
  queryVulnsBatch,
} from "../../src/api/osv.js";
import type { OsvVuln } from "../../src/api/osv.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VULN_FIXTURE: OsvVuln = {
  id: "GHSA-rv95-896h-c2vc",
  summary: "Express.js Open Redirect in malformed URLs",
  details: "Passing malformed URLs to the redirect function...",
  aliases: ["CVE-2024-29041"],
  modified: "2026-02-04T02:13:10.821360Z",
  published: "2024-03-25T21:15:47Z",
  references: [
    {
      type: "WEB",
      url: "https://github.com/expressjs/express/security/advisories/GHSA-rv95-896h-c2vc",
    },
  ],
  affected: [
    {
      package: { name: "express", ecosystem: "npm", purl: "pkg:npm/express" },
      ranges: [
        {
          type: "SEMVER",
          events: [{ introduced: "0" }, { fixed: "4.19.2" }],
        },
      ],
    },
  ],
  severity: [
    {
      type: "CVSS_V3",
      score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
    },
  ],
  database_specific: {
    severity: "MODERATE",
    github_reviewed: true,
    cwe_ids: ["CWE-1286", "CWE-601"],
  },
};

const CRITICAL_VULN_FIXTURE: OsvVuln = {
  id: "GHSA-xxxx-yyyy-zzzz",
  summary: "Remote code execution",
  modified: "2024-01-01T00:00:00Z",
  published: "2024-01-01T00:00:00Z",
  affected: [
    {
      package: { name: "lodash", ecosystem: "npm" },
      ranges: [
        {
          type: "SEMVER",
          events: [{ introduced: "0" }, { fixed: "4.17.21" }],
        },
      ],
    },
  ],
  database_specific: { severity: "CRITICAL" },
};

const NO_SEVERITY_VULN_FIXTURE: OsvVuln = {
  id: "GHSA-no-severity",
  summary: "Some vulnerability",
  modified: "2024-01-01T00:00:00Z",
  published: "2024-01-01T00:00:00Z",
  affected: [],
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// queryVulns
// ---------------------------------------------------------------------------

describe("queryVulns", () => {
  it("returns vulnerabilities for a package version", async () => {
    mockFetch({ vulns: [VULN_FIXTURE] });
    const result = await queryVulns("npm", "express", "4.18.2");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("GHSA-rv95-896h-c2vc");
  });

  it("returns empty array when no vulns found", async () => {
    mockFetch({});
    const result = await queryVulns("npm", "react", "18.0.0");
    expect(result).toEqual([]);
  });

  it("sends correct ecosystem name for PyPI", async () => {
    mockFetch({ vulns: [] });
    await queryVulns("pypi", "requests", "2.28.0");
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall?.[1]?.body as string) as { package: { ecosystem: string } };
    expect(body.package.ecosystem).toBe("PyPI");
  });

  it("sends correct ecosystem name for cargo", async () => {
    mockFetch({ vulns: [] });
    await queryVulns("cargo", "serde", "1.0.0");
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall?.[1]?.body as string) as { package: { ecosystem: string } };
    expect(body.package.ecosystem).toBe("crates.io");
  });

  it("throws OsvError on non-2xx response", async () => {
    mockFetch({}, 500);
    await expect(queryVulns("npm", "express", "4.18.2")).rejects.toThrow(OsvError);
  });
});

// ---------------------------------------------------------------------------
// queryVulnsBatch
// ---------------------------------------------------------------------------

describe("queryVulnsBatch", () => {
  it("returns results in same order as input", async () => {
    mockFetch({
      results: [{ vulns: [VULN_FIXTURE] }, {}],
    });
    const result = await queryVulnsBatch([
      { ecosystem: "npm", name: "express", version: "4.18.2" },
      { ecosystem: "npm", name: "react", version: "18.0.0" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1);
    expect(result[1]).toHaveLength(0);
  });

  it("returns empty array for empty input without calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await queryVulnsBatch([]);
    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends all packages in one batch request", async () => {
    mockFetch({ results: [{}, {}, {}] });
    await queryVulnsBatch([
      { ecosystem: "npm", name: "a", version: "1.0.0" },
      { ecosystem: "npm", name: "b", version: "2.0.0" },
      { ecosystem: "npm", name: "c", version: "3.0.0" },
    ]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall?.[1]?.body as string) as { queries: unknown[] };
    expect(body.queries).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getVuln
// ---------------------------------------------------------------------------

describe("getVuln", () => {
  it("returns full vulnerability details", async () => {
    mockFetch(VULN_FIXTURE);
    const result = await getVuln("GHSA-rv95-896h-c2vc");
    expect(result.id).toBe("GHSA-rv95-896h-c2vc");
    expect(result.summary).toContain("Open Redirect");
  });

  it("throws OsvError on 404", async () => {
    mockFetch({}, 404);
    await expect(getVuln("GHSA-nonexistent")).rejects.toThrow(OsvError);
  });
});

// ---------------------------------------------------------------------------
// extractSeverity
// ---------------------------------------------------------------------------

describe("extractSeverity", () => {
  it("returns MODERATE from database_specific severity", () => {
    expect(extractSeverity(VULN_FIXTURE)).toBe("MODERATE");
  });

  it("returns CRITICAL from database_specific severity", () => {
    expect(extractSeverity(CRITICAL_VULN_FIXTURE)).toBe("CRITICAL");
  });

  it("returns UNKNOWN when no severity data", () => {
    expect(extractSeverity(NO_SEVERITY_VULN_FIXTURE)).toBe("UNKNOWN");
  });

  it("is case-insensitive for severity label", () => {
    const vuln: OsvVuln = {
      ...NO_SEVERITY_VULN_FIXTURE,
      database_specific: { severity: "high" },
    };
    expect(extractSeverity(vuln)).toBe("HIGH");
  });
});

// ---------------------------------------------------------------------------
// extractCvssScore
// ---------------------------------------------------------------------------

describe("extractCvssScore", () => {
  it("returns null for CVSS vector strings (no numeric score in vector)", () => {
    // OSV provides vectors, not numeric scores — this should return null
    expect(extractCvssScore(VULN_FIXTURE)).toBeNull();
  });

  it("returns null when no severity entries", () => {
    expect(extractCvssScore(NO_SEVERITY_VULN_FIXTURE)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractFixVersions
// ---------------------------------------------------------------------------

describe("extractFixVersions", () => {
  it("extracts fix version from SEMVER range", () => {
    const versions = extractFixVersions(VULN_FIXTURE, "npm");
    expect(versions).toContain("4.19.2");
  });

  it("returns empty array when no fix version in range", () => {
    const vuln: OsvVuln = {
      ...VULN_FIXTURE,
      affected: [
        {
          package: { name: "express", ecosystem: "npm" },
          ranges: [
            {
              type: "SEMVER",
              events: [{ introduced: "0" }], // no fixed
            },
          ],
        },
      ],
    };
    expect(extractFixVersions(vuln, "npm")).toEqual([]);
  });

  it("filters by ecosystem correctly", () => {
    // VULN_FIXTURE has npm ecosystem, querying as pypi should return nothing
    const versions = extractFixVersions(VULN_FIXTURE, "pypi");
    expect(versions).toEqual([]);
  });

  it("deduplicates fix versions", () => {
    const vuln: OsvVuln = {
      ...VULN_FIXTURE,
      affected: [
        {
          package: { name: "express", ecosystem: "npm" },
          ranges: [
            { type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.19.2" }] },
            { type: "SEMVER", events: [{ introduced: "5.0.0" }, { fixed: "4.19.2" }] },
          ],
        },
      ],
    };
    const versions = extractFixVersions(vuln, "npm");
    expect(versions.filter((v) => v === "4.19.2")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// OsvError
// ---------------------------------------------------------------------------

describe("OsvError", () => {
  it("has correct name and status", async () => {
    mockFetch({}, 429);
    try {
      await queryVulns("npm", "express", "1.0.0");
    } catch (err) {
      expect(err).toBeInstanceOf(OsvError);
      expect((err as OsvError).status).toBe(429);
      expect((err as OsvError).name).toBe("OsvError");
    }
  });
});
