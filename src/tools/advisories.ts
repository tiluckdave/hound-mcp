import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdvisory } from "../api/depsdev.js";
import { getVuln } from "../api/osv.js";

export function register(server: McpServer) {
  return server.tool(
    "hound_advisories",
    "Get full details for a security advisory by ID (GHSA, CVE, or OSV ID). Returns title, severity, affected versions, fix versions, and references.",
    {
      id: z
        .string()
        .describe("Advisory ID — e.g. GHSA-rv95-896h-c2vc, CVE-2024-29041, or any OSV ID"),
    },
    async ({ id }) => {
      // Try OSV first (richer data), fall back to deps.dev advisory endpoint
      const [osvResult, depsdevResult] = await Promise.allSettled([getVuln(id), getAdvisory(id)]);

      const lines: string[] = [];

      if (osvResult.status === "fulfilled") {
        const vuln = osvResult.value;

        lines.push(`🔔 Advisory: ${vuln.id}`);
        lines.push("═".repeat(50));
        lines.push("");
        lines.push(`📋 Summary: ${vuln.summary}`);
        lines.push(`📅 Published: ${vuln.published.slice(0, 10)}`);
        lines.push(`🔄 Last modified: ${vuln.modified.slice(0, 10)}`);

        if (vuln.aliases && vuln.aliases.length > 0) {
          lines.push(`🔗 Also known as: ${vuln.aliases.join(", ")}`);
        }

        const dbSeverity = vuln.database_specific?.severity;
        if (dbSeverity) {
          lines.push(`⚠️  Severity: ${dbSeverity}`);
        }

        if (vuln.database_specific?.cwe_ids && vuln.database_specific.cwe_ids.length > 0) {
          lines.push(`🏷️  CWE: ${vuln.database_specific.cwe_ids.join(", ")}`);
        }

        if (vuln.affected.length > 0) {
          lines.push("");
          lines.push("📦 Affected packages");
          lines.push("─".repeat(30));

          for (const affected of vuln.affected) {
            lines.push(`  ${affected.package.ecosystem}: ${affected.package.name}`);

            for (const range of affected.ranges) {
              if (range.type === "SEMVER") {
                const introduced = range.events.find((e) => "introduced" in e);
                const fixed = range.events.find((e) => "fixed" in e);
                const introStr =
                  introduced && "introduced" in introduced ? introduced.introduced : "0";
                if (fixed && "fixed" in fixed) {
                  lines.push(`  Affected: >= ${introStr}, fixed in ${fixed.fixed}`);
                } else {
                  lines.push(`  Affected: >= ${introStr} (no fix available)`);
                }
              }
            }
          }
        }

        if (vuln.details) {
          lines.push("");
          lines.push("📝 Details");
          lines.push("─".repeat(30));
          // Trim details to a reasonable length
          const details =
            vuln.details.length > 500 ? `${vuln.details.slice(0, 500)}...` : vuln.details;
          lines.push(details);
        }

        if (vuln.references && vuln.references.length > 0) {
          lines.push("");
          lines.push("🔗 References");
          lines.push("─".repeat(30));
          for (const ref of vuln.references.slice(0, 5)) {
            lines.push(`  ${ref.url}`);
          }
          if (vuln.references.length > 5) {
            lines.push(`  ... and ${vuln.references.length - 5} more`);
          }
        }

        lines.push("");
        lines.push(`Source: https://osv.dev/vulnerability/${id}`);
      } else if (depsdevResult.status === "fulfilled") {
        // Fallback to deps.dev advisory data
        const advisory = depsdevResult.value;

        lines.push(`🔔 Advisory: ${advisory.advisoryKey.id}`);
        lines.push("═".repeat(50));
        lines.push("");
        lines.push(`📋 Title: ${advisory.title}`);

        if (advisory.aliases.length > 0) {
          lines.push(`🔗 Also known as: ${advisory.aliases.join(", ")}`);
        }

        lines.push(`⚠️  CVSS v3 Score: ${advisory.cvss3Score}`);
        lines.push(`📐 CVSS Vector: ${advisory.cvss3Vector}`);
        lines.push("");
        lines.push(`Source: ${advisory.url}`);
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Could not find advisory "${id}". Check the ID format (e.g. GHSA-xxxx-xxxx-xxxx or CVE-YYYY-NNNNN).`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
