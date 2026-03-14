import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DepsDevVersion } from "../../src/api/depsdev.js";
import {
  DepsDevError,
  extractProjectId,
  getAdvisory,
  getDependencies,
  getPackage,
  getProject,
  getVersion,
} from "../../src/api/depsdev.js";

// ---------------------------------------------------------------------------
// Fixtures — trimmed snapshots of real API responses
// ---------------------------------------------------------------------------

const VERSION_FIXTURE = {
  versionKey: { system: "NPM", name: "express", version: "4.18.2" },
  publishedAt: "2022-10-08T20:14:32Z",
  isDefault: false,
  licenses: ["MIT"],
  advisoryKeys: [{ id: "GHSA-rv95-896h-c2vc" }],
  links: [
    { label: "HOMEPAGE", url: "http://expressjs.com/" },
    { label: "SOURCE_REPO", url: "git+https://github.com/expressjs/express.git" },
  ],
  relatedProjects: [
    {
      projectKey: { id: "github.com/expressjs/express" },
      relationProvenance: "UNVERIFIED_METADATA",
      relationType: "SOURCE_REPO",
    },
  ],
};

const PACKAGE_FIXTURE = {
  packageKey: { system: "NPM", name: "express" },
  versions: [
    {
      versionKey: { system: "NPM", name: "express", version: "4.18.2" },
      publishedAt: "2022-10-08T20:14:32Z",
      isDefault: false,
    },
    {
      versionKey: { system: "NPM", name: "express", version: "5.2.1" },
      publishedAt: "2025-12-01T20:49:43Z",
      isDefault: true,
    },
  ],
};

const DEPENDENCIES_FIXTURE = {
  nodes: [
    {
      versionKey: { system: "NPM", name: "express", version: "4.18.2" },
      bundled: false,
      relation: "SELF",
      errors: [],
    },
    {
      versionKey: { system: "NPM", name: "accepts", version: "1.3.8" },
      bundled: false,
      relation: "DIRECT",
      errors: [],
    },
    {
      versionKey: { system: "NPM", name: "mime-types", version: "2.1.35" },
      bundled: false,
      relation: "INDIRECT",
      errors: [],
    },
  ],
  edges: [
    { fromNode: 0, toNode: 1, requirement: "~1.3.5" },
    { fromNode: 1, toNode: 2, requirement: "~2.1.24" },
  ],
};

const PROJECT_FIXTURE = {
  projectKey: { id: "github.com/expressjs/express" },
  openIssuesCount: 190,
  starsCount: 68838,
  forksCount: 22685,
  license: "MIT",
  description: "Fast, unopinionated, minimalist web framework for node.",
  homepage: "https://expressjs.com",
  scorecard: {
    date: "2026-03-02T00:00:00Z",
    repository: {
      name: "github.com/expressjs/express",
      commit: "6c4249feec8ab40631817c8e7001baf2ed022224",
    },
    overallScore: 8.3,
    checks: [
      { name: "Code-Review", score: 9, reason: "Found 22/23 approved changesets", details: [] },
      {
        name: "Maintained",
        score: 10,
        reason: "30 commit(s) out of 30 in the last 90 days",
        details: [],
      },
    ],
  },
};

const ADVISORY_FIXTURE = {
  advisoryKey: { id: "GHSA-rv95-896h-c2vc" },
  url: "https://osv.dev/vulnerability/GHSA-rv95-896h-c2vc",
  title: "Express.js Open Redirect in malformed URLs",
  aliases: ["CVE-2024-29041"],
  cvss3Score: 6.1,
  cvss3Vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
};

// ---------------------------------------------------------------------------
// Test setup: mock global fetch
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
// getVersion
// ---------------------------------------------------------------------------

describe("getVersion", () => {
  it("returns parsed version data", async () => {
    mockFetch(VERSION_FIXTURE);
    const result = await getVersion("npm", "express", "4.18.2");
    expect(result.versionKey.name).toBe("express");
    expect(result.licenses).toEqual(["MIT"]);
    expect(result.advisoryKeys).toHaveLength(1);
    expect(result.publishedAt).toBe("2022-10-08T20:14:32Z");
  });

  it("uses correct URL with encoded package name", async () => {
    mockFetch(VERSION_FIXTURE);
    await getVersion("npm", "@types/node", "18.0.0");
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall?.[0]).toContain("%40types%2Fnode");
  });

  it("throws DepsDevError on non-2xx response", async () => {
    mockFetch({ error: "not found" }, 404);
    await expect(getVersion("npm", "nonexistent", "1.0.0")).rejects.toThrow(DepsDevError);
  });

  it("includes correct ecosystem in URL", async () => {
    mockFetch(VERSION_FIXTURE);
    await getVersion("pypi", "requests", "2.28.0");
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall?.[0]).toContain("/systems/pypi/");
  });
});

// ---------------------------------------------------------------------------
// getPackage
// ---------------------------------------------------------------------------

describe("getPackage", () => {
  it("returns list of versions", async () => {
    mockFetch(PACKAGE_FIXTURE);
    const result = await getPackage("npm", "express");
    expect(result.versions).toHaveLength(2);
    expect(result.versions[1]?.isDefault).toBe(true);
  });

  it("identifies the default version", async () => {
    mockFetch(PACKAGE_FIXTURE);
    const result = await getPackage("npm", "express");
    const defaultVersion = result.versions.find((v) => v.isDefault);
    expect(defaultVersion?.versionKey.version).toBe("5.2.1");
  });
});

// ---------------------------------------------------------------------------
// getDependencies
// ---------------------------------------------------------------------------

describe("getDependencies", () => {
  it("returns nodes and edges", async () => {
    mockFetch(DEPENDENCIES_FIXTURE);
    const result = await getDependencies("npm", "express", "4.18.2");
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  it("correctly identifies relation types", async () => {
    mockFetch(DEPENDENCIES_FIXTURE);
    const result = await getDependencies("npm", "express", "4.18.2");
    const selfNode = result.nodes.find((n) => n.relation === "SELF");
    const directNode = result.nodes.find((n) => n.relation === "DIRECT");
    const indirectNode = result.nodes.find((n) => n.relation === "INDIRECT");
    expect(selfNode?.versionKey.name).toBe("express");
    expect(directNode?.versionKey.name).toBe("accepts");
    expect(indirectNode?.versionKey.name).toBe("mime-types");
  });

  it("uses :dependencies suffix in URL", async () => {
    mockFetch(DEPENDENCIES_FIXTURE);
    await getDependencies("npm", "express", "4.18.2");
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall?.[0]).toContain(":dependencies");
  });
});

// ---------------------------------------------------------------------------
// getProject
// ---------------------------------------------------------------------------

describe("getProject", () => {
  it("returns project metadata with scorecard", async () => {
    mockFetch(PROJECT_FIXTURE);
    const result = await getProject("github.com/expressjs/express");
    expect(result.starsCount).toBe(68838);
    expect(result.scorecard?.overallScore).toBe(8.3);
    expect(result.scorecard?.checks).toHaveLength(2);
  });

  it("encodes slashes in project ID", async () => {
    mockFetch(PROJECT_FIXTURE);
    await getProject("github.com/expressjs/express");
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall?.[0]).toContain("github.com%2Fexpressjs%2Fexpress");
    expect(fetchCall?.[0]).not.toContain("github.com/expressjs/express");
  });
});

// ---------------------------------------------------------------------------
// getAdvisory
// ---------------------------------------------------------------------------

describe("getAdvisory", () => {
  it("returns advisory details", async () => {
    mockFetch(ADVISORY_FIXTURE);
    const result = await getAdvisory("GHSA-rv95-896h-c2vc");
    expect(result.title).toBe("Express.js Open Redirect in malformed URLs");
    expect(result.cvss3Score).toBe(6.1);
    expect(result.aliases).toContain("CVE-2024-29041");
  });
});

// ---------------------------------------------------------------------------
// extractProjectId
// ---------------------------------------------------------------------------

describe("extractProjectId", () => {
  it("extracts SOURCE_REPO project id", () => {
    const version = VERSION_FIXTURE as DepsDevVersion;
    expect(extractProjectId(version)).toBe("github.com/expressjs/express");
  });

  it("returns null when no related projects", () => {
    const version: DepsDevVersion = {
      versionKey: { system: "NPM", name: "x", version: "1.0.0" },
      publishedAt: "2022-01-01T00:00:00Z",
      isDefault: false,
      relatedProjects: [],
    };
    expect(extractProjectId(version)).toBeNull();
  });

  it("returns null when relatedProjects is undefined", () => {
    const version: DepsDevVersion = {
      versionKey: { system: "NPM", name: "x", version: "1.0.0" },
      publishedAt: "2022-01-01T00:00:00Z",
      isDefault: false,
    };
    expect(extractProjectId(version)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DepsDevError
// ---------------------------------------------------------------------------

describe("DepsDevError", () => {
  it("has correct status and name", async () => {
    mockFetch({}, 500);
    try {
      await getVersion("npm", "express", "4.18.2");
    } catch (err) {
      expect(err).toBeInstanceOf(DepsDevError);
      expect((err as DepsDevError).status).toBe(500);
      expect((err as DepsDevError).name).toBe("DepsDevError");
    }
  });
});
