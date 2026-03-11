import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/upgrade.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const mockPackage = (versions: string[]) => ({
  packageKey: { system: "npm", name: "lodash" },
  versions: versions.map((v) => ({
    versionKey: { system: "npm", name: "lodash", version: v },
    publishedAt: "2023-01-01T00:00:00Z",
    isDefault: false,
  })),
});

describe("hound_upgrade", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
    vi.resetAllMocks();
  });

  it("returns minimum safe version when found", async () => {
    vi.mocked(depsdev.getPackage).mockResolvedValue(mockPackage(["4.17.20", "4.17.21", "4.17.22"]));
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([
      [{ id: "GHSA-x" } as never],
      [],
      [],
    ]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "lodash",
      version: "4.17.19",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Safe upgrade available");
    expect(text).toContain("4.17.21");
  });

  it("reports no safe upgrade when all versions are vulnerable", async () => {
    vi.mocked(depsdev.getPackage).mockResolvedValue(mockPackage(["4.17.21", "4.17.22"]));
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([
      [{ id: "GHSA-x" } as never],
      [{ id: "GHSA-y" } as never],
    ]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "lodash",
      version: "4.17.20",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("No safe upgrade found");
  });

  it("handles package not found", async () => {
    vi.mocked(depsdev.getPackage).mockRejectedValue(new Error("not found"));

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "nonexistent-pkg",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Could not find package");
  });

  it("handles no newer versions available", async () => {
    vi.mocked(depsdev.getPackage).mockResolvedValue(mockPackage(["4.17.19", "4.17.20"]));
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "lodash",
      version: "4.17.20",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("No newer versions");
  });
});
