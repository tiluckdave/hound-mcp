import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/preinstall.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const mockPackage = (version = "1.0.0") => ({
  packageKey: { system: "npm", name: "express" },
  versions: [
    {
      versionKey: { system: "npm", name: "express", version },
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      isDefault: true,
    },
  ],
});

const mockVersion = (overrides: Record<string, unknown> = {}) => ({
  versionKey: { system: "npm", name: "express", version: "1.0.0" },
  publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  isDefault: true,
  licenses: ["MIT"],
  advisoryKeys: [],
  relatedProjects: [],
  links: [],
  ...overrides,
});

describe("hound_preinstall", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
    vi.resetAllMocks();
  });

  it("returns GO verdict for clean package", async () => {
    vi.mocked(depsdev.getPackage).mockResolvedValue(mockPackage());
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("GO");
    expect(text).toContain("No issues found");
  });

  it("returns NO-GO verdict for package with critical vulnerabilities", async () => {
    vi.mocked(depsdev.getPackage).mockResolvedValue(mockPackage());
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion());
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([
      { id: "GHSA-x", database_specific: { severity: "CRITICAL" } } as never,
    ]);
    vi.mocked(osv.extractSeverity).mockReturnValue("CRITICAL");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("NO-GO");
    expect(text).toContain("CRITICAL");
  });

  it("warns about copyleft license", async () => {
    vi.mocked(depsdev.getPackage).mockResolvedValue(mockPackage());
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion({ licenses: ["GPL-3.0"] }));
    vi.mocked(depsdev.extractProjectId).mockReturnValue(null);
    vi.mocked(osv.queryVulns).mockResolvedValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "express",
      version: "1.0.0",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Copyleft");
    expect(text).toContain("CAUTION");
  });

  it("handles package not found", async () => {
    vi.mocked(depsdev.getPackage).mockRejectedValue(new Error("not found"));

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      name: "nonexistent",
      ecosystem: "npm",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Could not find package");
  });
});
