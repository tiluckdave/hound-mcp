import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/compare.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const mockPackage = (name: string, version: string) => ({
  packageKey: { system: "npm", name },
  versions: [
    {
      versionKey: { system: "npm", name, version },
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      isDefault: true,
    },
  ],
});

const mockVersion = (name: string, version: string, licenses = ["MIT"]) => ({
  versionKey: { system: "npm", name, version },
  publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  isDefault: true,
  licenses,
  advisoryKeys: [],
  relatedProjects: [],
  links: [],
});

const mockProject = (id: string, scorecardScore: number | null, starsCount: number) => ({
  projectKey: { id },
  openIssuesCount: 0,
  starsCount,
  forksCount: 0,
  license: "MIT",
  description: "",
  homepage: "",
  scorecard:
    scorecardScore === null
      ? null
      : {
          date: "2026-01-01",
          repository: { name: id, commit: "abc123" },
          overallScore: scorecardScore,
          checks: [],
        },
});

describe("hound_compare", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
    vi.resetAllMocks();
  });

  it("returns comparison table for two valid packages", async () => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("express", "4.18.2"))
      .mockResolvedValueOnce(mockPackage("fastify", "4.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce(mockVersion("express", "4.18.2"))
      .mockResolvedValueOnce(mockVersion("fastify", "4.0.0"));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "express",
      package_b: "fastify",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Package Comparison");
    expect(text).toContain("express");
    expect(text).toContain("fastify");
    expect(text).toContain("Recommendation");
  });

  it("reports prefer package with fewer vulnerabilities", async () => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockPackage("pkg-b", "1.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce(mockVersion("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockVersion("pkg-b", "1.0.0"));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns)
      .mockResolvedValueOnce([
        { id: "GHSA-x", database_specific: { severity: "CRITICAL" } } as never,
      ])
      .mockResolvedValueOnce([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "pkg-a",
      package_b: "pkg-b",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Prefer pkg-b");
  });

  it.each([
    [8.7, 6.2, "pkg-a"],
    [6.2, 8.7, "pkg-b"],
  ])("compares OpenSSF Scorecard data (%s vs %s)", async (scoreA, scoreB, preferred) => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockPackage("pkg-b", "1.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce(mockVersion("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockVersion("pkg-b", "1.0.0"));
    vi.mocked(depsdev.extractProjectId)
      .mockReturnValueOnce("github.com/example/pkg-a")
      .mockReturnValueOnce("github.com/example/pkg-b");
    vi.mocked(depsdev.getProject)
      .mockResolvedValueOnce(mockProject("github.com/example/pkg-a", scoreA, 100))
      .mockResolvedValueOnce(mockProject("github.com/example/pkg-b", scoreB, 100));
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "pkg-a",
      package_b: "pkg-b",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("OpenSSF Scorecard");
    expect(text).toContain(scoreA.toFixed(1));
    expect(text).toContain(scoreB.toFixed(1));
    expect(text).toContain(`Prefer ${preferred} — leads on 1 of 6 criteria`);
  });

  it("uses secondary health signals when vulnerability counts are equal", async () => {
    const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockPackage("pkg-b", "1.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce({
        ...mockVersion("pkg-a", "1.0.0", ["GPL-3.0"]),
        publishedAt: staleDate,
      })
      .mockResolvedValueOnce({
        ...mockVersion("pkg-b", "1.0.0"),
        publishedAt: recentDate,
      });
    vi.mocked(depsdev.extractProjectId)
      .mockReturnValueOnce("github.com/example/pkg-a")
      .mockReturnValueOnce("github.com/example/pkg-b");
    vi.mocked(depsdev.getProject)
      .mockResolvedValueOnce(mockProject("github.com/example/pkg-a", null, 100))
      .mockResolvedValueOnce(mockProject("github.com/example/pkg-b", null, 200));
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "pkg-a",
      package_b: "pkg-b",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toMatch(/Vulnerabilities\s+None\s+None/);
    expect(text).toContain("GitHub stars");
    expect(text).toContain("200 ✓");
    expect(text).toContain("License risk");
    expect(text).toContain("Prefer pkg-b — leads on 3 of 6 criteria");
  });

  it("handles package_a not found", async () => {
    vi.mocked(depsdev.getPackage)
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(mockPackage("fastify", "4.0.0"));
    vi.mocked(depsdev.getVersion).mockResolvedValueOnce(mockVersion("fastify", "4.0.0"));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "nonexistent",
      package_b: "fastify",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Could not find nonexistent");
  });

  it("handles package_b not found", async () => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("express", "4.18.2"))
      .mockRejectedValueOnce(new Error("not found"));
    vi.mocked(depsdev.getVersion).mockResolvedValueOnce(mockVersion("express", "4.18.2"));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "express",
      package_b: "nonexistent",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Could not find nonexistent");
  });

  it("handles both packages not found", async () => {
    vi.mocked(depsdev.getPackage).mockRejectedValue(new Error("not found"));

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "pkg-a",
      package_b: "pkg-b",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Could not find either");
  });
});
