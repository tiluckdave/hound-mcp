import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { extractProjectId, getPackage, getProject, getVersion } from "../api/depsdev.js";
import { extractSeverity, queryVulns } from "../api/osv.js";
import type { Ecosystem } from "../types/index.js";

const ECOSYSTEM_VALUES = ["npm", "pypi", "go", "maven", "cargo", "nuget", "rubygems"] as const;

const COPYLEFT_LICENSES = new Set([
  "GPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later",
  "GPL-3.0", "GPL-3.0-only", "GPL-3.0-or-later",
  "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
  "LGPL-2.0", "LGPL-2.1", "LGPL-3.0",
  "EUPL-1.1", "EUPL-1.2", "MPL-2.0", "OSL-3.0", "CDDL-1.0", "EPL-1.0", "EPL-2.0",
]);

export function register(server: McpServer) {
  return server.registerTool(
    "hound_preinstall",
    {
      description:
        "Safety check before installing a package. Checks known vulnerabilities, typosquatting risk, abandonment, and license concerns. Returns a go/no-go verdict.",
      inputSchema: {
        name: z.string().describe("Package name"),
        version: z.string().optional().describe("Package version (defaults to latest)"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
      },
    },
    async ({ name, version, ecosystem }) => {
      const eco = ecosystem as Ecosystem;

      // Resolve version if not provided
      let resolvedVersion = version ?? "";
      if (!resolvedVersion) {
        try {
          const pkg = await getPackage(eco, name);
          const defaultV =
            pkg.versions.find((v) => v.isDefault) ?? pkg.versions[pkg.versions.length - 1];
          resolvedVersion = defaultV?.versionKey.version ?? "";
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `❌ Could not find package ${name} in ${ecosystem}. Check the package name.`,
              },
            ],
          };
        }
      }

      if (!resolvedVersion) {
        return {
          content: [
            { type: "text", text: `❌ Could not resolve a version for ${name} in ${ecosystem}.` },
          ],
        };
      }

      const [versionResult, vulnsResult] = await Promise.allSettled([
        getVersion(eco, name, resolvedVersion),
        queryVulns(eco, name, resolvedVersion),
      ]);

      if (versionResult.status === "rejected") {
        return {
          content: [
            {
              type: "text",
              text: `❌ Could not find ${name}@${resolvedVersion} in ${ecosystem}.`,
            },
          ],
        };
      }

      const pkg = versionResult.value;
      const vulns = vulnsResult.status === "fulfilled" ? vulnsResult.value : [];

      const projectId = extractProjectId(pkg);
      const projectData = projectId !== null ? await getProject(projectId).catch(() => null) : null;

      // --- Checks ---
      const issues: { level: "block" | "warn" | "info"; message: string }[] = [];

      // 1. Vulnerabilities
      const criticalVulns = vulns.filter((v) => {
        const sev = extractSeverity(v);
        return sev === "CRITICAL" || sev === "HIGH";
      });
      if (criticalVulns.length > 0) {
        issues.push({
          level: "block",
          message: `${criticalVulns.length} CRITICAL/HIGH vulnerabilit${criticalVulns.length === 1 ? "y" : "ies"} known for this version`,
        });
      } else if (vulns.length > 0) {
        issues.push({
          level: "warn",
          message: `${vulns.length} moderate/low vulnerabilit${vulns.length === 1 ? "y" : "ies"} known for this version`,
        });
      }

      // 2. Typosquatting heuristics
      const typoReasons: string[] = [];
      if (/[0O1lI]/.test(name)) typoReasons.push("contains look-alike characters (0/O, 1/l/I)");
      if (name.length <= 2) typoReasons.push("very short name");
      if (/(.)\1{2,}/.test(name)) typoReasons.push("repeated characters");
      if (/[^a-z0-9@/._-]/.test(name)) typoReasons.push("unusual characters in name");
      if (typoReasons.length >= 2) {
        issues.push({
          level: "warn",
          message: `Possible typosquatting risk: ${typoReasons.join("; ")}`,
        });
      }

      // 3. Abandonment — no update in >2 years + no scorecard
      const daysSince = Math.floor(
        (Date.now() - new Date(pkg.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince > 730) {
        issues.push({
          level: "warn",
          message: `Package version is ${Math.floor(daysSince / 365)} year(s) old — may be abandoned`,
        });
      }

      // 4. Low OpenSSF scorecard
      if (projectData?.scorecard != null && projectData.scorecard.overallScore < 3) {
        issues.push({
          level: "warn",
          message: `Low OpenSSF Scorecard score: ${projectData.scorecard.overallScore.toFixed(1)}/10`,
        });
      } else if (projectData === null) {
        issues.push({
          level: "info",
          message: "No OpenSSF Scorecard data available",
        });
      }

      // 5. License
      const licenses = pkg.licenses ?? [];
      if (licenses.length === 0) {
        issues.push({ level: "warn", message: "License unknown" });
      } else if (licenses.some((l) => COPYLEFT_LICENSES.has(l))) {
        issues.push({
          level: "warn",
          message: `Copyleft license detected: ${licenses.join(", ")}`,
        });
      }

      // --- Verdict ---
      const blockers = issues.filter((i) => i.level === "block");
      const warnings = issues.filter((i) => i.level === "warn");
      const infos = issues.filter((i) => i.level === "info");

      const verdict = blockers.length > 0 ? "NO-GO" : warnings.length > 0 ? "CAUTION" : "GO";
      const verdictEmoji = verdict === "GO" ? "✅" : verdict === "CAUTION" ? "⚠️" : "🚫";

      const lines: string[] = [
        `${verdictEmoji} Pre-install check: ${name}@${resolvedVersion} (${ecosystem})`,
        "═".repeat(60),
        `Verdict: ${verdict}`,
        "",
      ];

      if (blockers.length > 0) {
        lines.push("🚫 Blockers");
        lines.push("─".repeat(30));
        for (const issue of blockers) {
          lines.push(`  • ${issue.message}`);
        }
        lines.push("");
      }

      if (warnings.length > 0) {
        lines.push("⚠️  Warnings");
        lines.push("─".repeat(30));
        for (const issue of warnings) {
          lines.push(`  • ${issue.message}`);
        }
        lines.push("");
      }

      if (infos.length > 0) {
        lines.push("ℹ️  Info");
        lines.push("─".repeat(30));
        for (const issue of infos) {
          lines.push(`  • ${issue.message}`);
        }
        lines.push("");
      }

      if (blockers.length === 0 && warnings.length === 0) {
        lines.push("  No issues found — safe to install.");
        lines.push("");
      }

      if (vulns.length > 0) {
        lines.push(`💡 Run hound_vulns for full vulnerability details.`);
      }
      if (blockers.length > 0) {
        lines.push(`💡 Run hound_upgrade to find a safe version.`);
      }

      lines.push("");
      lines.push("Source: OSV.dev + deps.dev");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
