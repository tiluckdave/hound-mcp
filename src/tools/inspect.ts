import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { extractProjectId, getProject, getVersion } from "../api/depsdev.js";
import { extractSeverity, queryVulns } from "../api/osv.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import type { Ecosystem } from "../types/index.js";

export function register(server: McpServer) {
  return server.registerTool(
    "hound_inspect",
    {
      description:
        "Get a comprehensive profile of a package version: licenses, vulnerabilities, OpenSSF scorecard, GitHub stats, and dependency count — all in one call.",
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

      const [versionData, vulns] = await Promise.allSettled([
        getVersion(eco, name, version),
        queryVulns(eco, name, version),
      ]);

      if (versionData.status === "rejected") {
        return {
          content: [
            {
              type: "text",
              text: `Could not find ${name}@${version} in ${ecosystem}. Check the package name and version.`,
            },
          ],
        };
      }

      const pkg = versionData.value;
      const vulnList = vulns.status === "fulfilled" ? vulns.value : [];

      // Try to fetch project info (scorecard, stars) — non-fatal if missing
      const projectId = extractProjectId(pkg);
      const projectData = projectId !== null ? await getProject(projectId).catch(() => null) : null;

      const lines: string[] = [`📦 ${name}@${version} (${ecosystem})`, "═".repeat(50), ""];

      // Published date
      const published = pkg.publishedAt.slice(0, 10);
      const daysSince = Math.floor(
        (Date.now() - new Date(pkg.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      lines.push(`📅 Published: ${published} (${daysSince} days ago)`);

      // License
      const licenses =
        pkg.licenses && pkg.licenses.length > 0 ? pkg.licenses.join(", ") : "Unknown";
      lines.push(`📄 License: ${licenses}`);

      // Vulnerabilities
      if (vulnList.length === 0) {
        lines.push(`🛡️  Vulnerabilities: None known`);
      } else {
        const counts: Record<string, number> = {};
        for (const v of vulnList) {
          const sev = extractSeverity(v);
          counts[sev] = (counts[sev] ?? 0) + 1;
        }
        const summary = Object.entries(counts)
          .map(([s, n]) => `${n} ${s.toLowerCase()}`)
          .join(", ");
        lines.push(`⚠️  Vulnerabilities: ${vulnList.length} (${summary})`);
      }

      // Known advisories from deps.dev
      const advisoryCount = pkg.advisoryKeys?.length ?? 0;
      if (advisoryCount > 0) {
        const ids = pkg.advisoryKeys?.map((a) => a.id).join(", ");
        lines.push(`🔔 Advisories: ${ids}`);
      }

      // GitHub / project info
      if (projectData !== null) {
        lines.push("");
        lines.push("📊 Project Health");
        lines.push("─".repeat(30));
        lines.push(`⭐ Stars: ${projectData.starsCount.toLocaleString()}`);
        lines.push(`🍴 Forks: ${projectData.forksCount.toLocaleString()}`);
        lines.push(`🐛 Open issues: ${projectData.openIssuesCount.toLocaleString()}`);

        if (projectData.scorecard !== null) {
          const score = projectData.scorecard.overallScore.toFixed(1);
          const grade = scorecardGrade(projectData.scorecard.overallScore);
          lines.push(`🏆 OpenSSF Scorecard: ${score}/10 (${grade})`);

          const weak = [...projectData.scorecard.checks]
            .sort((a, b) => a.score - b.score)
            .slice(0, 3);
          if (weak.length > 0) {
            lines.push(
              `   Lowest checks: ${weak.map((c) => `${c.name} (${c.score}/10)`).join(", ")}`,
            );
          }
        }
      }

      // Links
      const homepage = pkg.links?.find((l) => l.label === "HOMEPAGE");
      const sourceRepo = pkg.links?.find((l) => l.label === "SOURCE_REPO");
      if (homepage ?? sourceRepo) {
        lines.push("");
        if (homepage) lines.push(`🌐 Homepage: ${homepage.url}`);
        if (sourceRepo) lines.push(`💻 Source: ${sourceRepo.url}`);
      }

      lines.push("");
      lines.push(
        `🔗 deps.dev: https://deps.dev/${ecosystem}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`,
      );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}

function scorecardGrade(score: number): string {
  if (score >= 9) return "A";
  if (score >= 7) return "B";
  if (score >= 5) return "C";
  if (score >= 3) return "D";
  return "F";
}
