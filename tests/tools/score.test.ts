import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/score.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const mockVersion = (overrides: Record<string, unknown> = {}) => ({
  versionKey: { system: "npm", name: "express", version: "4.18.2" },
  publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  isDefault: true,
  licenses: ["MIT"],
  advisoryKeys: [],
  relatedProjects: [],
  links: [],
  ...overrides,
});

describe("hound_score", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
    vi.resetAllMocks();
  });

  it("returns high score for healthy package", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Hound Score");
    expect(text).toContain("/100");
    expect(text).toContain("No known vulnerabilities");
  });

  it("penalizes score for critical vulnerabilities", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([
      { id: "GHSA-x", database_specific: { severity: "CRITICAL" } } as never,
      { id: "GHSA-y", database_specific: { severity: "CRITICAL" } } as never,
    ]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("known vuln");
  });

  it("flags copyleft license", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion({ licenses: ["GPL-3.0"] } as never));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "some-pkg",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Copyleft license");
  });

  it("includes scorecard data when project exists", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue("github.com/expressjs/express");
    vi.mocked(depsdev.getProject).mockResolvedValue({
      projectKey: { id: "github.com/expressjs/express" },
      openIssuesCount: 10,
      starsCount: 60000,
      forksCount: 10000,
      license: "MIT",
      description: "Fast web framework",
      homepage: "https://expressjs.com",
      scorecard: { date: "2024-01-01", repository: { name: "express", commit: "abc" }, overallScore: 7.5, checks: [] },
    });
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("OpenSSF Scorecard");
    expect(text).toContain("7.5");
  });

  it("handles project without scorecard", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue("github.com/expressjs/express");
    vi.mocked(depsdev.getProject).mockResolvedValue({
      projectKey: { id: "github.com/expressjs/express" },
      openIssuesCount: 0,
      starsCount: 100,
      forksCount: 10,
      license: "MIT",
      description: "",
      homepage: "",
      scorecard: null,
    });
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Hound Score");
  });

  it("flags unknown license when licenses array is empty", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion({ licenses: [] }));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "mystery-pkg",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("License unknown");
  });

  it("penalizes stale packages published over 2 years ago", async () => {
    const oldDate = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion({ publishedAt: oldDate }));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "old-pkg",
      version: "0.1.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("days ago");
  });

  it("penalizes HIGH severity vulns", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([{ id: "GHSA-h" } as never]);
    vi.mocked(osv.extractSeverity).mockReturnValue("HIGH");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("1 high");
  });

  it("handles moderate and low severity vulns", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([
      { id: "GHSA-a" } as never,
      { id: "GHSA-b" } as never,
    ]);
    vi.mocked(osv.extractSeverity)
      .mockReturnValueOnce("MODERATE")
      .mockReturnValueOnce("LOW");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("known vuln");
  });

  it("penalizes packages published 6-12 months ago", async () => {
    const date = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion({ publishedAt: date }));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "med-pkg",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("days ago");
    // Recency score should be 15 (>180 days but <365)
    expect(text).toContain("15/20");
  });

  it("returns F grade for a heavily penalized package", async () => {
    // 3 CRITICAL vulns (0/40) + no scorecard (0/25) + stale >2yr (5/20) + no license (5/15) = 10 → F
    const oldDate = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion({ publishedAt: oldDate, licenses: [] }));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([
      { id: "GHSA-1" } as never,
      { id: "GHSA-2" } as never,
      { id: "GHSA-3" } as never,
    ]);
    vi.mocked(osv.extractSeverity).mockReturnValue("CRITICAL");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "bad-pkg",
      version: "0.1.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Grade F");
  });

  it("returns D grade for package with HIGH vulns", async () => {
    // 2 HIGH vulns (20/40) + no scorecard (0/25) + recent (20/20) + MIT (15/15) = 55 → D
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([
      { id: "GHSA-1" } as never,
      { id: "GHSA-2" } as never,
    ]);
    vi.mocked(osv.extractSeverity).mockReturnValue("HIGH");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "risky-pkg",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Grade D");
  });

  it("returns C grade for package with one critical vuln and decent scorecard", async () => {
    // 1 CRITICAL vuln (20/40) + scorecard 5/10 (13/25) + recent (20/20) + MIT (15/15) = 68 → C
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue("github.com/test/pkg");
    vi.mocked(depsdev.getProject).mockResolvedValue({
      projectKey: { id: "github.com/test/pkg" },
      openIssuesCount: 0,
      starsCount: 100,
      forksCount: 10,
      license: "MIT",
      description: "",
      homepage: "",
      scorecard: { date: "2024-01-01", repository: { name: "test", commit: "abc" }, overallScore: 5.0, checks: [] },
    });
    vi.mocked(osv.queryVulns).mockResolvedValue([{ id: "GHSA-1" } as never]);
    vi.mocked(osv.extractSeverity).mockReturnValue("CRITICAL");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "med-risk-pkg",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Grade C");
  });

  it("handles package not found", async () => {
    vi.mocked(depsdev.getVersion).mockRejectedValue(new Error("not found"));
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "nonexistent",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Could not find");
  });
});
