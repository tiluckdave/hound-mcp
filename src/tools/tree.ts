import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { getDependencies } from "../api/depsdev.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import type { Ecosystem } from "../types/index.js";

export function register(server: McpServer) {
  return server.registerTool(
    "hound_tree",
    {
      description:
        "Show the full resolved dependency tree for a package version, including all transitive dependencies with their depth and relation type.",
      inputSchema: {
        name: z.string().describe("Package name"),
        version: z.string().describe("Package version"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(3)
          .describe("Maximum depth to display (default: 3, max: 10)"),
      },
    },
    async ({ name, version, ecosystem, maxDepth }) => {
      let deps: Awaited<ReturnType<typeof getDependencies>>;
      try {
        deps = await getDependencies(ecosystem as Ecosystem, name, version);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Could not fetch dependency tree for ${name}@${version}. Check the package name and version.`,
            },
          ],
        };
      }

      const nodes = deps.nodes;
      const edges = deps.edges;

      const directCount = nodes.filter((n) => n.relation === "DIRECT").length;
      const indirectCount = nodes.filter((n) => n.relation === "INDIRECT").length;
      const totalCount = directCount + indirectCount;

      // Build adjacency: nodeIndex → children nodeIndexes
      const children = new Map<number, number[]>();
      for (const edge of edges) {
        if (!children.has(edge.fromNode)) children.set(edge.fromNode, []);
        children.get(edge.fromNode)?.push(edge.toNode);
      }

      const lines: string[] = [
        `🌳 Dependency tree for ${name}@${version} (${ecosystem})`,
        "═".repeat(50),
        `${totalCount} total dependencies (${directCount} direct, ${indirectCount} transitive)`,
        "",
      ];

      // Render tree recursively from node 0 (SELF)
      const rootNode = nodes[0];
      if (rootNode) {
        renderNode(lines, nodes, children, 0, 0, maxDepth, new Set());
      }

      if (maxDepth < 10 && indirectCount > 0) {
        lines.push("");
        lines.push(`ℹ️  Showing up to depth ${maxDepth}. Use maxDepth to see deeper.`);
      }

      lines.push("");
      lines.push(`Source: deps.dev`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}

function renderNode(
  lines: string[],
  nodes: { versionKey: { name: string; version: string }; relation: string; errors: string[] }[],
  children: Map<number, number[]>,
  nodeIndex: number,
  depth: number,
  maxDepth: number,
  visited: Set<number>,
): void {
  if (visited.has(nodeIndex)) return;
  visited.add(nodeIndex);

  const node = nodes[nodeIndex];
  if (!node) return;

  const indent = "  ".repeat(depth);
  const isRoot = depth === 0;
  const prefix = isRoot ? "" : "├── ";
  const errorSuffix = node.errors.length > 0 ? " ⚠️" : "";
  lines.push(`${indent}${prefix}${node.versionKey.name}@${node.versionKey.version}${errorSuffix}`);

  if (depth >= maxDepth) {
    const childCount = children.get(nodeIndex)?.length ?? 0;
    if (childCount > 0) {
      lines.push(`${indent}  └── ... (${childCount} more)`);
    }
    return;
  }

  for (const childIdx of children.get(nodeIndex) ?? []) {
    renderNode(lines, nodes, children, childIdx, depth + 1, maxDepth, visited);
  }
}
