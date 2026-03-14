import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import { register } from "../../src/tools/tree.js";

vi.mock("../../src/api/depsdev.js");

const DEPS_FIXTURE: depsdev.DepsDevDependencies = {
  nodes: [
    {
      versionKey: { system: "NPM", name: "express", version: "4.18.2" },
      bundled: false,
      relation: "SELF",
      errors: [],
    },
    {
      versionKey: { system: "NPM", name: "accepts", version: "1.3.8" },
      bundled: false,
      relation: "DIRECT",
      errors: [],
    },
    {
      versionKey: { system: "NPM", name: "mime-types", version: "2.1.35" },
      bundled: false,
      relation: "INDIRECT",
      errors: [],
    },
  ],
  edges: [
    { fromNode: 0, toNode: 1, requirement: "~1.3.5" },
    { fromNode: 1, toNode: 2, requirement: "~2.1.24" },
  ],
};

function getText(result: unknown): string {
  return (result as { content: { text: string }[] }).content[0]?.text ?? "";
}

describe("hound_tree", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the dependency tree", async () => {
    vi.mocked(depsdev.getDependencies).mockResolvedValue(DEPS_FIXTURE);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
      maxDepth: 3,
    });
    const text = getText(result);
    expect(text).toContain("express@4.18.2");
    expect(text).toContain("accepts@1.3.8");
    expect(text).toContain("mime-types@2.1.35");
  });

  it("shows dependency counts in header", async () => {
    vi.mocked(depsdev.getDependencies).mockResolvedValue(DEPS_FIXTURE);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
      maxDepth: 3,
    });
    const text = getText(result);
    expect(text).toContain("2 total dependencies");
    expect(text).toContain("1 direct");
    expect(text).toContain("1 transitive");
  });

  it("respects maxDepth limit", async () => {
    vi.mocked(depsdev.getDependencies).mockResolvedValue(DEPS_FIXTURE);

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      name: "express",
      version: "4.18.2",
      ecosystem: "npm",
      maxDepth: 1,
    });
    const text = getText(result);
    expect(text).toContain("accepts@1.3.8");
    // mime-types is at depth 2, should be truncated
    expect(text).toContain("more");
  });

  it("returns error when package not found", async () => {
    vi.mocked(depsdev.getDependencies).mockRejectedValue(new Error("Not found"));

    const result = await (tool.handler as (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>)({
      name: "nonexistent",
      version: "1.0.0",
      ecosystem: "npm",
      maxDepth: 3,
    });
    const text = getText(result);
    expect(text).toContain("Could not fetch");
  });
});
