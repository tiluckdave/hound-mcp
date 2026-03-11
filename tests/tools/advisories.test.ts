import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import type { OsvVuln } from "../../src/api/osv.js";
import * as osv from "../../src/api/osv.js";
import { register } from "../../src/tools/advisories.js";

vi.mock("../../src/api/depsdev.js");
vi.mock("../../src/api/osv.js");

const OSV_FIXTURE: OsvVuln = {
  id: "GHSA-rv95-896h-c2vc",
  summary: "Express.js Open Redirect in malformed URLs",
  details: "Passing malformed URLs to the redirect function allows open redirect.",
  aliases: ["CVE-2024-29041"],
  modified: "2026-02-04T00:00:00Z",
  published: "2024-03-25T00:00:00Z",
  references: [
    {
      type: "WEB",
      url: "https://github.com/expressjs/express/security/advisories/GHSA-rv95-896h-c2vc",
    },
    { type: "WEB", url: "https://nvd.nist.gov/vuln/detail/CVE-2024-29041" },
  ],
  affected: [
    {
      package: { name: "express", ecosystem: "npm", purl: "pkg:npm/express" },
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.19.2" }] }],
    },
  ],
  severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N" }],
  database_specific: { severity: "MODERATE", github_reviewed: true, cwe_ids: ["CWE-601"] },
};

const DEPSDEV_ADVISORY_FIXTURE: depsdev.DepsDevAdvisory = {
  advisoryKey: { id: "GHSA-rv95-896h-c2vc" },
  url: "https://github.com/advisories/GHSA-rv95-896h-c2vc",
  title: "Express.js Open Redirect",
  aliases: ["CVE-2024-29041"],
  cvss3Score: 6.1,
  cvss3Vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",
};

function getText(result: unknown): string {
  return (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
}

describe("hound_advisories", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows OSV data when available", async () => {
    vi.mocked(osv.getVuln).mockResolvedValue(OSV_FIXTURE);
    vi.mocked(depsdev.getAdvisory).mockResolvedValue(DEPSDEV_ADVISORY_FIXTURE);

    const result = await tool.handler({ id: "GHSA-rv95-896h-c2vc" });
    const text = getText(result);
    expect(text).toContain("GHSA-rv95-896h-c2vc");
    expect(text).toContain("Express.js Open Redirect in malformed URLs");
    expect(text).toContain("CVE-2024-29041");
    expect(text).toContain("MODERATE");
    expect(text).toContain("CWE-601");
    expect(text).toContain("4.19.2");
  });

  it("falls back to deps.dev when OSV fails", async () => {
    vi.mocked(osv.getVuln).mockRejectedValue(new Error("Not found"));
    vi.mocked(depsdev.getAdvisory).mockResolvedValue(DEPSDEV_ADVISORY_FIXTURE);

    const result = await tool.handler({ id: "GHSA-rv95-896h-c2vc" });
    const text = getText(result);
    expect(text).toContain("GHSA-rv95-896h-c2vc");
    expect(text).toContain("Express.js Open Redirect");
    expect(text).toContain("6.1");
  });

  it("returns error when both sources fail", async () => {
    vi.mocked(osv.getVuln).mockRejectedValue(new Error("Not found"));
    vi.mocked(depsdev.getAdvisory).mockRejectedValue(new Error("Not found"));

    const result = await tool.handler({ id: "GHSA-xxxx-yyyy-zzzz" });
    const text = getText(result);
    expect(text).toContain("Could not find advisory");
    expect(text).toContain("GHSA-xxxx-yyyy-zzzz");
  });

  it("shows references list", async () => {
    vi.mocked(osv.getVuln).mockResolvedValue(OSV_FIXTURE);
    vi.mocked(depsdev.getAdvisory).mockResolvedValue(DEPSDEV_ADVISORY_FIXTURE);

    const result = await tool.handler({ id: "GHSA-rv95-896h-c2vc" });
    const text = getText(result);
    expect(text).toContain("github.com/expressjs/express/security/advisories");
  });
});
