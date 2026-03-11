import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as depsdev from "../../src/api/depsdev.js";
import { register } from "../../src/tools/typosquat.js";

vi.mock("../../src/api/depsdev.js");

const makePackage = (name: string, versions = 5): depsdev.DepsDevPackage => ({
  packageKey: { system: "NPM", name },
  versions: Array.from({ length: versions }, (_, i) => ({
    versionKey: { system: "NPM", name, version: `1.0.${i}` },
    publishedAt: "2024-01-01T00:00:00Z",
    isDefault: i === versions - 1,
  })),
});

function getText(result: unknown): string {
  return (result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
}

describe("hound_typosquat", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports no typosquats when no variants exist", async () => {
    vi.mocked(depsdev.getPackage).mockImplementation(async (_, name) => {
      if (name === "lodash") return makePackage("lodash", 100);
      throw new Error("Not found");
    });

    const result = await tool.handler({ name: "lodash", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("lodash");
    expect(text).toContain("No typosquat variants found");
  });

  it("reports existing typosquat variants", async () => {
    vi.mocked(depsdev.getPackage).mockImplementation(async (_, name) => {
      // lodash and lodas both exist
      if (name === "lodash" || name === "lodas") return makePackage(name, 5);
      throw new Error("Not found");
    });

    const result = await tool.handler({ name: "lodash", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("lodas");
    expect(text).toContain("5 versions");
  });

  it("warns when target package doesn't exist", async () => {
    vi.mocked(depsdev.getPackage).mockRejectedValue(new Error("Not found"));

    const result = await tool.handler({ name: "myfakepackage", ecosystem: "npm" });
    const text = getText(result);
    expect(text).toContain("does not exist");
  });
});
