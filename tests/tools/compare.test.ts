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

const mockProject = (overallScore: number, starsCount: number) => ({
  projectKey: { id: "github.com/foo/bar" },
  openIssuesCount: 0,
  starsCount,
  forksCount: 0,
  license: "MIT",
  description: "",
  homepage: "",
  scorecard: {
    date: "2024-01-01",
    repository: { name: "foo/bar", commit: "abc" },
    overallScore,
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

  it("shows scorecard and star data when both packages resolve a project", async () => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("left-pad", "1.3.0"))
      .mockResolvedValueOnce(mockPackage("right-pad", "1.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce(mockVersion("left-pad", "1.3.0"))
      .mockResolvedValueOnce(mockVersion("right-pad", "1.0.0"));
    vi.mocked(depsdev.extractProjectId)
      .mockReturnValueOnce("github.com/foo/left-pad")
      .mockReturnValueOnce("github.com/foo/right-pad");
    vi.mocked(depsdev.getProject)
      .mockResolvedValueOnce(mockProject(8.5, 5000))
      .mockResolvedValueOnce(mockProject(6.2, 1000));
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "left-pad",
      package_b: "right-pad",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("8.5");
    expect(text).toContain("6.2");
    expect(text).toContain("5,000");
    expect(text).toContain("1,000");
    expect(text).toContain("Prefer left-pad");
  });

  it("falls back to recency and license when vulnerability counts are equal", async () => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("pkg-fresh", "2.0.0"))
      .mockResolvedValueOnce(mockPackage("pkg-stale", "1.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce({
        ...mockVersion("pkg-fresh", "2.0.0"),
        publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .mockResolvedValueOnce({
        ...mockVersion("pkg-stale", "1.0.0", ["GPL-3.0"]),
        publishedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      });
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "pkg-fresh",
      package_b: "pkg-stale",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Copyleft");
    expect(text).toContain("Prefer pkg-fresh");
  });

  it("reports a tie when both packages are equal on every criterion", async () => {
    vi.mocked(depsdev.getPackage)
      .mockResolvedValueOnce(mockPackage("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockPackage("pkg-b", "1.0.0"));
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce(mockVersion("pkg-a", "1.0.0"))
      .mockResolvedValueOnce(mockVersion("pkg-b", "1.0.0"));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      package_a: "pkg-a",
      package_b: "pkg-b",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Both packages are roughly equivalent");
  });
});
