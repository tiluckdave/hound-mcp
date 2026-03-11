import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/audit.js";

vi.mock("../../src/api/osv.js");

const PACKAGE_LOCK = JSON.stringify({
  lockfileVersion: 3,
  packages: {
    "": { name: "my-app", version: "1.0.0" },
    "node_modules/express": { version: "4.18.2" },
    "node_modules/lodash": { version: "4.17.21" },
  },
});

const REQUIREMENTS_TXT = `
requests==2.28.0
flask==2.3.0
# a comment
`;

describe("hound_audit", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
    vi.resetAllMocks();
  });

  it("reports clean audit for package-lock.json with no vulns", async () => {
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([[], []]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: PACKAGE_LOCK,
      lockfile_name: "package-lock.json",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Hound Audit Report");
    expect(text).toContain("No known vulnerabilities");
  });

  it("reports vulnerabilities found in dependencies", async () => {
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([
      [{ id: "GHSA-critical", summary: "Remote code execution", database_specific: { severity: "CRITICAL" } } as never],
      [],
    ]);
    vi.mocked(osv.extractSeverity).mockReturnValue("CRITICAL");

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: PACKAGE_LOCK,
      lockfile_name: "package-lock.json",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("CRITICAL");
    expect(text).toContain("GHSA-critical");
  });

  it("parses requirements.txt and reports clean", async () => {
    vi.mocked(osv.queryVulnsBatch).mockResolvedValue([[], []]);

    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: REQUIREMENTS_TXT,
      lockfile_name: "requirements.txt",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Hound Audit Report");
    expect(text).toContain("No known vulnerabilities");
  });

  it("returns error for unsupported lockfile format", async () => {
    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({
      lockfile_content: "{}",
      lockfile_name: "composer.lock",
    });

    const text = (result as { content: { text: string }[] }).content[0]?.text ?? "";
    expect(text).toContain("Unsupported lockfile format");
  });
});
