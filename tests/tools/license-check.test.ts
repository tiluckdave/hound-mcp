import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import { register } from "../../src/tools/license-check.js";

vi.mock("../../src/api/depsdev.js");

const PACKAGE_LOCK = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { name: "my-app", version: "1.0.0" },
    "node_modules/express": { version: "4.18.2" },
    "node_modules/gpl-pkg": { version: "1.0.0" },
  },
});

const mockVersion = (licenses: string[]) => ({
  versionKey: { system: "npm", name: "express", version: "4.18.2" },
  publishedAt: "2023-01-01T00:00:00Z",
  isDefault: true,
  licenses,
  advisoryKeys: [],
  relatedProjects: [],
  links: [],
});

describe("hound_license_check", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
    vi.resetAllMocks();
  });

  it("reports no violations for all-permissive packages", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion(["MIT"]));

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: PACKAGE_LOCK,
      lockfile_name: "package-lock.json",
      policy: "permissive",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("No license violations");
  });

  it("flags copyleft license under permissive policy", async () => {
    vi.mocked(depsdev.getVersion)
      .mockResolvedValueOnce(mockVersion(["MIT"]))
      .mockResolvedValueOnce(mockVersion(["GPL-3.0"]));

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: PACKAGE_LOCK,
      lockfile_name: "package-lock.json",
      policy: "permissive",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("license violation");
    expect(text).toContain("GPL-3.0");
  });

  it("handles unsupported lockfile format", async () => {
    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: "{}",
      lockfile_name: "composer.lock",
      policy: "permissive",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Unsupported lockfile format");
  });

  it("reports license distribution summary", async () => {
    vi.mocked(depsdev.getVersion).mockResolvedValue(mockVersion(["Apache-2.0"]));

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: PACKAGE_LOCK,
      lockfile_name: "package-lock.json",
      policy: "none",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("License distribution");
    expect(text).toContain("Apache-2.0");
  });
});
