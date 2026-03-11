import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OsvVuln } from "../../src/api/osv.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/vulns.js";

vi.mock("../../src/api/osv.js");

const VULN_FIXTURE: OsvVuln = {
  id: "GHSA-rv95-896h-c2vc",
  summary: "Express.js Open Redirect",
  details: "Details here",
  aliases: ["CVE-2024-29041"],
  modified: "2026-02-04T00:00:00Z",
  published: "2024-03-25T00:00:00Z",
  references: [{ type: "WEB", url: "https://example.com" }],
  affected: [
    {
      package: { name: "express", ecosystem: "npm", purl: "pkg:npm/express" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.19.2" }] }],
    },
  ],
  severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N" }],
  database_specific: { severity: "MODERATE", github_reviewed: true, cwe_ids: [] },
};

function getText(result: unknown): string {
  return (result as { content: { text: string }[] }).content[0]?.text ?? "";
}

describe("hound_vulns", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no-vulnerability message when none found", async () => {
    vi.mocked(osv.queryVulns).mockResolvedValue([]);
    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({ name: "express", version: "4.19.2", ecosystem: "npm" });
    expect(getText(result)).toContain("No known vulnerabilities");
  });

  it("shows vulnerability details grouped by severity", async () => {
    vi.mocked(osv.queryVulns).mockResolvedValue([VULN_FIXTURE]);
    vi.mocked(osv.extractSeverity).mockReturnValue("MODERATE");
    vi.mocked(osv.extractFixVersions).mockReturnValue(["4.19.2"]);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({ name: "express", version: "4.18.2", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("GHSA-rv95-896h-c2vc");
    expect(text).toContain("Express.js Open Redirect");
    expect(text).toContain("MODERATE");
    expect(text).toContain("4.19.2");
  });

  it("shows alias in output", async () => {
    vi.mocked(osv.queryVulns).mockResolvedValue([VULN_FIXTURE]);
    vi.mocked(osv.extractSeverity).mockReturnValue("MODERATE");
    vi.mocked(osv.extractFixVersions).mockReturnValue([]);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({ name: "express", version: "4.18.2", ecosystem: "npm" });
    expect(getText(result)).toContain("CVE-2024-29041");
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(osv.queryVulns).mockRejectedValue(new Error("API down"));
    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({ name: "express", version: "4.18.2", ecosystem: "npm" });
    expect(getText(result)).toContain("Failed");
  });
});
