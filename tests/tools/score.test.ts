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
