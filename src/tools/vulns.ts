import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { extractFixVersions, extractSeverity, queryVulns } from "../api/osv.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import type { Ecosystem } from "../types/index.js";

const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MODERATE: "🟡",
  LOW: "🔵",
  UNKNOWN: "⚪",
};

export function register(server: McpServer) {
  return server.registerTool(
    "hound_vulns",
    {
      description:
        "List all known vulnerabilities for a specific package version, grouped by severity with fix versions and advisory links.",
      inputSchema: {
        name: z.string().describe("Package name (e.g. express, lodash)"),
        version: z.string().describe("Package version (e.g. 4.18.2)"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
      },
    },
    async ({ name, version, ecosystem }) => {
      let vulns: Awaited<ReturnType<typeof queryVulns>>;
      try {
        vulns = await queryVulns(ecosystem as Ecosystem, name, version);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Failed to query vulnerabilities for ${name}@${version}. The OSV API may be temporarily unavailable.`,
            },
          ],
        };
      }

      if (vulns.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `✅ No known vulnerabilities found for ${name}@${version} (${ecosystem}).\n\nThis checks the OSV database which covers GitHub Advisory Database, NVD, and more.`,
            },
          ],
        };
      }

      const bySeverity: Record<string, typeof vulns> = {
        CRITICAL: [],
        HIGH: [],
        MODERATE: [],
        LOW: [],
        UNKNOWN: [],
      };

      for (const vuln of vulns) {
        const sev = extractSeverity(vuln);
        bySeverity[sev]?.push(vuln);
      }

      const lines: string[] = [
        `🔍 Vulnerabilities in ${name}@${version} (${ecosystem})`,
        "─".repeat(50),
        `Found ${vulns.length} vulnerability${vulns.length === 1 ? "" : "ies"}`,
        "",
      ];

      for (const severity of ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"]) {
        const group = bySeverity[severity] ?? [];
        if (group.length === 0) continue;

        const icon = SEVERITY_ICON[severity] ?? "⚪";
        lines.push(`${icon} ${severity} (${group.length})`);
        lines.push("─".repeat(30));

        for (const vuln of group) {
          lines.push(`  ${vuln.id}`);
          lines.push(`  ${vuln.summary}`);

          const fixes = extractFixVersions(vuln, ecosystem as Ecosystem);
          if (fixes.length > 0) {
            lines.push(`  Fix: upgrade to ${fixes.join(" or ")}`);
          } else {
            lines.push(`  Fix: no patched version available`);
          }

          if (vuln.aliases && vuln.aliases.length > 0) {
            lines.push(`  Also known as: ${vuln.aliases.join(", ")}`);
          }

          lines.push(`  Published: ${vuln.published.slice(0, 10)}`);
          lines.push("");
        }
      }

      lines.push(`Source: https://osv.dev`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
