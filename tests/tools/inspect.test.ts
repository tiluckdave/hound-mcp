import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import type { OsvVuln } from "../../src/api/osv.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/inspect.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const VERSION_FIXTURE: depsdev.DepsDevVersion = {
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

const PROJECT_FIXTURE: depsdev.DepsDevProject = {
  projectKey: { id: "github.com/expressjs/express" },
  starsCount: 62000,
  forksCount: 13000,
  openIssuesCount: 170,
  license: "MIT",
  description: "Fast, unopinionated, minimalist web framework",
  homepage: "https://expressjs.com",
  scorecard: {
    date: "2024-01-01",
    repository: { name: "github.com/expressjs/express", commit: "abc123" },
    overallScore: 7.5,
    checks: [
      { name: "Code-Review", score: 10, reason: "All commits reviewed", details: [] },
      { name: "Maintained", score: 10, reason: "Active", details: [] },
      { name: "Binary-Artifacts", score: 3, reason: "Binary present", details: [] },
    ],
  },
};

function getText(result: unknown): string {
  return (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
}

describe("hound_inspect", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows package info for a clean package", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(VERSION_FIXTURE);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);

    const result = await tool.handler({ name: "express", version: "4.18.2", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("express@4.18.2");
    expect(text).toContain("MIT");
    expect(text).toContain("None known");
  });

  it("shows vulnerabilities when present", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(VERSION_FIXTURE);
    const vuln: OsvVuln = {
      id: "GHSA-rv95-896h-c2vc",
      summary: "Open Redirect",
      modified: "2026-01-01T00:00:00Z",
      published: "2024-01-01T00:00:00Z",
      affected: [],
    };
    vi.mocked(osv.queryVulns).mockResolvedValue([vuln]);
    vi.mocked(osv.extractSeverity).mockReturnValue("MODERATE");
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);

    const result = await tool.handler({ name: "express", version: "4.18.2", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("1");
    expect(text).toContain("moderate");
  });

  it("shows project health when available", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(VERSION_FIXTURE);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);
    vi.mocked(depsdev.extractProjectId).mockReturnValue("github.com/expressjs/express");
    vi.mocked(depsdev.getProject).mockResolvedValue(PROJECT_FIXTURE);

    const result = await tool.handler({ name: "express", version: "4.18.2", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("62,000");
    expect(text).toContain("7.5/10");
    expect(text).toContain("Binary-Artifacts");
  });

  it("returns error message when package not found", async () => {
    vi.mocked(depsdev.getVersion).mockRejectedValue(new Error("Not found"));
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await tool.handler({ name: "nonexistent", version: "1.0.0", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("Could not find");
  });
});
