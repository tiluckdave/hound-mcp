import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import type { OsvVuln } from "../../src/api/osv.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/popular.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const makePackage = (name: string): depsdev.DepsDevPackage => ({
  packageKey: { system: "NPM", name },
  versions: [
    {
      versionKey: { system: "NPM", name, version: "1.0.0" },
      publishedAt: "2024-01-01T00:00:00Z",
      isDefault: true,
    },
  ],
});

const VULN_FIXTURE: OsvVuln = {
  id: "GHSA-test-0001-vuln",
  summary: "Test vulnerability",
  modified: "2026-01-01T00:00:00Z",
  published: "2024-01-01T00:00:00Z",
  affected: [],
};

function getText(result: unknown): string {
  return (result as { content: { text: string }[] }).content[0]?.text ?? "";
}

describe("hound_popular", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows all-clean message when no vulns found", async () => {
    vi.mocked(depsdev.getPackage).mockImplementation(async (_, name) => makePackage(name));
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([[], []]);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      ecosystem: "npm",
      packages: ["express", "lodash"],
    });
    const text = getText(result);
    expect(text).toContain("clean");
    expect(text).toContain("express@1.0.0");
    expect(text).toContain("lodash@1.0.0");
  });

  it("shows vulnerable packages with details", async () => {
    vi.mocked(depsdev.getPackage).mockImplementation(async (_, name) => makePackage(name));
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([[VULN_FIXTURE], []]);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      ecosystem: "npm",
      packages: ["express", "lodash"],
    });
    const text = getText(result);
    expect(text).toContain("1 of 2 packages have vulnerabilities");
    expect(text).toContain("GHSA-test-0001-vuln");
    expect(text).toContain("Test vulnerability");
  });

  it("uses default package list when none specified", async () => {
    vi.mocked(depsdev.getPackage).mockImplementation(async (_, name) => makePackage(name));
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue(Array.from({ length: 10 }, () => []));

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({ ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("npm popular packages");
    expect(text).toContain("express@1.0.0");
  });

  it("notes packages that could not be resolved", async () => {
    vi.mocked(depsdev.getPackage).mockImplementation(async (_, name) => {
      if (name === "express") return makePackage("express");
      throw new Error("Not found");
    });
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([[]]);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      ecosystem: "npm",
      packages: ["express", "badpkg"],
    });
    const text = getText(result);
    expect(text).toContain("1 package(s) could not be resolved");
  });
});
