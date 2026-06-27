import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { extractSeverity, queryVulnsBatch } from "../api/osv.js";
import { parseLockfile } from "../parsers/index.js";
import type { Ecosystem } from "../types/index.js";
import { formatUnsupportedLockfileMessage } from "../utils/lockfileFormat.js";

const MAX_BATCH = 100; // Cap to avoid huge requests

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"] as const;

const SEVERITY_ICON: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MODERATE: "🟡",
  LOW: "🔵",
  UNKNOWN: "⚪",
};

export function register(server: McpServer) {
  return server.registerTool(
    "hound_audit",
    {
      description:
        "Scan a project's lockfile for dependency risks. Parses package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, go.sum, Gemfile.lock, or pubspec.lock and batch-queries OSV for vulnerabilities across all dependencies.",
      inputSchema: {
        lockfile_content: z.string().describe("Full text content of the lockfile"),
        lockfile_name: z
          .string()
          .describe(
            "Filename to determine format: package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, go.sum, Gemfile.lock, or pubspec.lock",
          ),
      },
    },
    async ({ lockfile_content, lockfile_name }) => {
      const deps = parseLockfile(lockfile_name, lockfile_content);

      if (deps === null) {
        return {
          content: [
            {
              type: "text",
              text: formatUnsupportedLockfileMessage(lockfile_name),
            },
          ],
        };
      }

      if (deps.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No dependencies found in ${lockfile_name}. The file may be empty or malformed.`,
            },
          ],
        };
      }

      // Deduplicate dependencies by name and version.
      const seen = new Set<string>();

      const unique = deps.filter((dependency) => {
        const key = `${dependency.name}@${dependency.version}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

      const toCheck = unique.slice(0, MAX_BATCH);
      const truncated = unique.length > MAX_BATCH;

      // Query OSV for all selected dependencies in one batch.
      const vulnerabilityResults = await queryVulnsBatch(
        toCheck.map((dependency) => ({
          ecosystem: dependency.ecosystem as Ecosystem,
          name: dependency.name,
          version: dependency.version,
        })),
      );

      interface Finding {
        name: string;
        version: string;
        severity: string;
        id: string;
        summary: string;
      }

      const findings: Finding[] = [];
      const vulnerabilityCounts: Partial<Record<string, number>> = {};

      for (let index = 0; index < toCheck.length; index++) {
        const dependency = toCheck[index];

        if (!dependency) {
          continue;
        }

        const vulnerabilities = vulnerabilityResults[index] ?? [];

        for (const vulnerability of vulnerabilities) {
          const severity = extractSeverity(vulnerability);

          vulnerabilityCounts[severity] = (vulnerabilityCounts[severity] ?? 0) + 1;

          findings.push({
            name: dependency.name,
            version: dependency.version,
            severity,
            id: vulnerability.id,
            summary: vulnerability.summary,
          });
        }
      }

      const totalVulnerabilities = findings.length;

      const affectedPackages = new Set(
        findings.map((finding) => `${finding.name}@${finding.version}`),
      ).size;

      const lines: string[] = [
        "📊 Hound Audit Report",
        "═".repeat(50),
        `Lockfile: ${lockfile_name}`,
        `Scanned:  ${toCheck.length} dependencies${
          truncated ? ` (capped at ${MAX_BATCH} of ${unique.length})` : ""
        }`,
        "",
      ];

      if (totalVulnerabilities === 0) {
        lines.push("✅ No known vulnerabilities found!");
      } else {
        lines.push(
          `Found ${totalVulnerabilities} vulnerabilit${
            totalVulnerabilities === 1 ? "y" : "ies"
          } across ${affectedPackages} package${affectedPackages === 1 ? "" : "s"}:`,
        );

        for (const severity of SEVERITY_ORDER) {
          const count = vulnerabilityCounts[severity] ?? 0;

          if (count > 0) {
            const icon = SEVERITY_ICON[severity] ?? "⚪";
            lines.push(`  ${icon} ${count} ${severity.toLowerCase()}`);
          }
        }
      }

      lines.push("");

      if (findings.length > 0) {
        lines.push("─".repeat(50));
        lines.push("Vulnerable Packages");
        lines.push("─".repeat(50));

        for (const severity of SEVERITY_ORDER) {
          const group = findings.filter((finding) => finding.severity === severity);

          if (group.length === 0) {
            continue;
          }

          const icon = SEVERITY_ICON[severity] ?? "⚪";
          lines.push(`\n${icon} ${severity} (${group.length})`);

          const findingsByPackage: Record<string, Finding[]> = {};

          for (const finding of group) {
            const key = `${finding.name}@${finding.version}`;
            (findingsByPackage[key] ??= []).push(finding);
          }

          for (const [packageName, packageFindings] of Object.entries(
            findingsByPackage,
          )) {
            lines.push(`  ${packageName}`);

            for (const finding of packageFindings) {
              lines.push(`    ${finding.id}: ${finding.summary}`);
            }
          }
        }

        lines.push("");
        lines.push("─".repeat(50));
        lines.push("💡 Run hound_upgrade <package> to find a safe version for each.");
        lines.push("💡 Run hound_vulns <package> <version> for full advisory details.");
      }

      if (truncated) {
        lines.push("");
        lines.push(
          `⚠️  Only the first ${MAX_BATCH} of ${unique.length} dependencies were checked.`,
        );
      }

      lines.push("");
      lines.push("Source: OSV.dev");

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    },
  );
}