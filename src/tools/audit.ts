import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { parseLockfile } from "../parsers/index.js";
import { extractSeverity, queryVulnsBatch } from "../api/osv.js";
import type { Ecosystem } from "../types/index.js";

const MAX_BATCH = 100; // cap to avoid huge requests

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
        "Scan a project's lockfile for dependency risks. Parses package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, or go.sum and batch-queries OSV for vulnerabilities across all dependencies.",
      inputSchema: {
        lockfile_content: z.string().describe("Full text content of the lockfile"),
        lockfile_name: z
          .string()
          .describe(
            "Filename to determine format: package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, go.sum",
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
              text: `Unsupported lockfile format: ${lockfile_name}\n\nSupported formats: package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, go.sum`,
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

      // Deduplicate by name@version
      const seen = new Set<string>();
      const unique = deps.filter((d) => {
        const key = `${d.name}@${d.version}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const toCheck = unique.slice(0, MAX_BATCH);
      const truncated = unique.length > MAX_BATCH;

      // Batch query OSV
      const vulnResults = await queryVulnsBatch(
        toCheck.map((d) => ({ ecosystem: d.ecosystem as Ecosystem, name: d.name, version: d.version })),
      );

      // Build vulnerability findings
      interface Finding {
        name: string;
        version: string;
        severity: string;
        id: string;
        summary: string;
      }

      const findings: Finding[] = [];
      const vulnCounts: Partial<Record<string, number>> = {};

      for (let i = 0; i < toCheck.length; i++) {
        const dep = toCheck[i];
        const vulns = vulnResults[i] ?? [];
        if (!dep) continue;
        for (const v of vulns) {
          const sev = extractSeverity(v);
          vulnCounts[sev] = (vulnCounts[sev] ?? 0) + 1;
          findings.push({
            name: dep.name,
            version: dep.version,
            severity: sev,
            id: v.id,
            summary: v.summary,
          });
        }
      }

      const totalVulns = findings.length;
      const affectedPkgs = new Set(findings.map((f) => `${f.name}@${f.version}`)).size;

      // --- Report ---
      const lines: string[] = [
        "📊 Hound Audit Report",
        "═".repeat(50),
        `Lockfile: ${lockfile_name}`,
        `Scanned:  ${toCheck.length} dependencies${truncated ? ` (capped at ${MAX_BATCH} of ${unique.length})` : ""}`,
        "",
      ];

      // Summary counts
      if (totalVulns === 0) {
        lines.push("✅ No known vulnerabilities found!");
      } else {
        lines.push(`Found ${totalVulns} vulnerabilit${totalVulns === 1 ? "y" : "ies"} across ${affectedPkgs} package${affectedPkgs === 1 ? "" : "s"}:`);
        for (const sev of SEVERITY_ORDER) {
          const count = vulnCounts[sev] ?? 0;
          if (count > 0) {
            const icon = SEVERITY_ICON[sev] ?? "⚪";
            lines.push(`  ${icon} ${count} ${sev.toLowerCase()}`);
          }
        }
      }

      lines.push("");

      // Detailed findings grouped by severity
      if (findings.length > 0) {
        lines.push("─".repeat(50));
        lines.push("Vulnerable Packages");
        lines.push("─".repeat(50));

        for (const sev of SEVERITY_ORDER) {
          const group = findings.filter((f) => f.severity === sev);
          if (group.length === 0) continue;

          const icon = SEVERITY_ICON[sev] ?? "⚪";
          lines.push(`\n${icon} ${sev} (${group.length})`);

          // Group by package
          const byPkg: Record<string, Finding[]> = {};
          for (const f of group) {
            const key = `${f.name}@${f.version}`;
            (byPkg[key] ??= []).push(f);
          }

          for (const [pkg, pkgFindings] of Object.entries(byPkg)) {
            lines.push(`  ${pkg}`);
            for (const f of pkgFindings) {
              lines.push(`    ${f.id}: ${f.summary}`);
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
        lines.push(`⚠️  Only the first ${MAX_BATCH} of ${unique.length} dependencies were checked.`);
      }

      lines.push("");
      lines.push("Source: OSV.dev");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
