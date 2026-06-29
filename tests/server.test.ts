import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";

/**
 * Integration test: verifies that createServer() registers all expected tools.
 *
 * Problem this solves: if a developer adds a new tool file but forgets to call
 * register() in server.ts, it silently doesn't exist and no other test catches it.
 */

const EXPECTED_TOOLS = [
  "hound_advisories",
  "hound_audit",
  "hound_compare",
  "hound_inspect",
  "hound_license_check",
  "hound_popular",
  "hound_preinstall",
  "hound_score",
  "hound_tree",
  "hound_typosquat",
  "hound_upgrade",
  "hound_vulns",
] as const;

/**
 * Spins up a real server + in-memory client pair and returns the names of all
 * tools reported by the server's tools/list response.
 */
async function getRegisteredToolNames(): Promise<string[]> {
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  return tools.map((t) => t.name);
}

describe("createServer — tool registration", () => {
  it(`registers exactly ${EXPECTED_TOOLS.length} tools`, async () => {
    const names = await getRegisteredToolNames();
    expect(names).toHaveLength(EXPECTED_TOOLS.length);
  });

  it("registers all expected tool names", async () => {
    const names = await getRegisteredToolNames();
    expect(names.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it.each(EXPECTED_TOOLS)("registers tool: %s", async (toolName) => {
    const names = await getRegisteredToolNames();
    expect(names).toContain(toolName);
  });
});
