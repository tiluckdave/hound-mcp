import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { extractProjectId, getProject, getVersion } from "../api/depsdev.js";
import { extractSeverity, queryVulns } from "../api/osv.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import { COPYLEFT_LICENSES } from "../constants/licenses.js";
import type { Ecosystem } from "../types/index.js";

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function gradeEmoji(grade: string): string {
  switch (grade) {
    case "A": return "🟢";
    case "B": return "🟡";
    case "C": return "🟠";
    case "D": return "🔴";
    default:  return "💀";
  }
}

export function register(server: McpServer) {
  return server.registerTool(
    "hound_score",
    {
      description:
        "Compute a 0-100 Hound Score for a package version combining vulnerability severity, OpenSSF Scorecard, release recency, and license risk. Returns a letter grade (A-F) with a breakdown.",
      inputSchema: {
        name: z.string().describe("Package name"),
        version: z.string().describe("Package version"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
      },
    },
    async ({ name, version, ecosystem }) => {
      const eco = ecosystem as Ecosystem;

      const [versionResult, vulnsResult] = await Promise.allSettled([
        getVersion(eco, name, version),
        queryVulns(eco, name, version),
      ]);

      if (versionResult.status === "rejected") {
        return {
          content: [
            {
              type: "text",
              text: `Could not find ${name}@${version} in ${ecosystem}. Check the package name and version.`,
            },
          ],
        };
      }

      const pkg = versionResult.value;
      const vulns = vulnsResult.status === "fulfilled" ? vulnsResult.value : [];

      const projectId = extractProjectId(pkg);
      const projectData = projectId !== null ? await getProject(projectId).catch(() => null) : null;

      // --- Scoring components ---

      // 1. Vulnerability score (0-40 points)
      let vulnScore = 40;
      for (const v of vulns) {
        const sev = extractSeverity(v);
        switch (sev) {
          case "CRITICAL": vulnScore -= 20; break;
          case "HIGH":     vulnScore -= 10; break;
          case "MODERATE": vulnScore -= 5;  break;
          case "LOW":      vulnScore -= 2;  break;
        }
      }
      vulnScore = Math.max(0, vulnScore);

      // 2. OpenSSF Scorecard (0-25 points)
      let scorecardScore = 0;
      if (projectData?.scorecard != null) {
        scorecardScore = Math.round((projectData.scorecard.overallScore / 10) * 25);
      } else if (projectData !== null) {
        scorecardScore = 10; // project exists but no scorecard
      }

      // 3. Recency score (0-20 points) — penalize stale packages
      let recencyScore = 20;
      const daysSince = Math.floor(
        (Date.now() - new Date(pkg.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince > 730) recencyScore = 5;       // >2 years
      else if (daysSince > 365) recencyScore = 10; // >1 year
      else if (daysSince > 180) recencyScore = 15; // >6 months

      // 4. License score (0-15 points)
      let licenseScore = 15;
      const licenses = pkg.licenses ?? [];
      if (licenses.length === 0) {
        licenseScore = 5; // unknown license
      } else if (licenses.some((l) => COPYLEFT_LICENSES.has(l))) {
        licenseScore = 8; // copyleft
      }

      const total = vulnScore + scorecardScore + recencyScore + licenseScore;
      const grade = letterGrade(total);
      const emoji = gradeEmoji(grade);

      const lines: string[] = [
        `${emoji} Hound Score: ${total}/100 — Grade ${grade}`,
        `   ${name}@${version} (${ecosystem})`,
        "═".repeat(50),
        "",
        "Score Breakdown",
        "─".repeat(30),
        `  Security (vulns)    ${vulnScore.toString().padStart(3)}/40`,
        `  OpenSSF Scorecard   ${scorecardScore.toString().padStart(3)}/25`,
        `  Release recency     ${recencyScore.toString().padStart(3)}/20`,
        `  License             ${licenseScore.toString().padStart(3)}/15`,
        `                      ${"─".repeat(6)}`,
        `  Total               ${total.toString().padStart(3)}/100`,
        "",
      ];

      // Details
      if (vulns.length > 0) {
        const counts: Record<string, number> = {};
        for (const v of vulns) {
          const sev = extractSeverity(v);
          counts[sev] = (counts[sev] ?? 0) + 1;
        }
        const summary = Object.entries(counts).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(", ");
        lines.push(`⚠️  ${vulns.length} known vuln(s): ${summary}`);
      } else {
        lines.push("✅ No known vulnerabilities");
      }

      if (projectData?.scorecard != null) {
        lines.push(`🏆 OpenSSF Scorecard: ${projectData.scorecard.overallScore.toFixed(1)}/10`);
      } else if (projectData === null) {
        lines.push("ℹ️  No OpenSSF Scorecard data available");
      }

      lines.push(`📅 Published ${daysSince} days ago`);

      if (licenses.length === 0) {
        lines.push("⚠️  License unknown");
      } else if (licenses.some((l) => COPYLEFT_LICENSES.has(l))) {
        lines.push(`⚠️  Copyleft license: ${licenses.join(", ")}`);
      } else {
        lines.push(`✅ License: ${licenses.join(", ")}`);
      }

      lines.push("");
      lines.push("Source: OSV.dev + deps.dev");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
