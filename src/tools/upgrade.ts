import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { getPackage } from "../api/depsdev.js";
import { queryVulnsBatch } from "../api/osv.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import type { Ecosystem } from "../types/index.js";

function parseVersion(v: string): number[] {
  return v.split(".").map((p) => parseInt(p.replace(/[^0-9]/g, ""), 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function register(server: McpServer) {
  return server.registerTool(
    "hound_upgrade",
    {
      description:
        "Find the minimum version upgrade that resolves all known vulnerabilities for a package. Checks every published version and returns the nearest safe one.",
      inputSchema: {
        name: z.string().describe("Package name (e.g. express, lodash)"),
        version: z.string().describe("Current vulnerable version (e.g. 4.17.20)"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
      },
    },
    async ({ name, version, ecosystem }) => {
      const eco = ecosystem as Ecosystem;

      let pkg: Awaited<ReturnType<typeof getPackage>>;
      try {
        pkg = await getPackage(eco, name);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Could not find package ${name} in ${ecosystem}. Check the package name.`,
            },
          ],
        };
      }

      // Filter to versions newer than current, sort ascending
      const candidates = pkg.versions
        .map((v) => v.versionKey.version)
        .filter((v) => compareVersions(v, version) > 0)
        .sort(compareVersions);

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️  No newer versions of ${name} found in ${ecosystem}.\nCurrent version: ${version}\n\nThis may be the latest version already.`,
            },
          ],
        };
      }

      // Batch query all candidates (up to 50 to avoid huge requests)
      const toCheck = candidates.slice(0, 50);
      const vulnResults = await queryVulnsBatch(
        toCheck.map((v) => ({ ecosystem: eco, name, version: v })),
      );

      const safeVersions = toCheck.filter((_, i) => (vulnResults[i]?.length ?? 0) === 0);
      const latestVersion = candidates.at(-1) ?? version;
      const latestVulns = vulnResults[toCheck.indexOf(latestVersion)] ?? [];

      const lines: string[] = [
        `🔍 Safe upgrade finder: ${name} (${ecosystem})`,
        "═".repeat(50),
        `Current version: ${version}`,
        `Candidates checked: ${toCheck.length} of ${candidates.length} newer versions`,
        "",
      ];

      if (safeVersions.length === 0) {
        lines.push(`❌ No safe upgrade found — all ${toCheck.length} newer versions have known vulnerabilities.`);
        lines.push("");
        lines.push("Consider:");
        lines.push("  • Checking if a patch is in progress via hound_advisories");
        lines.push("  • Evaluating an alternative package via hound_compare");
      } else {
        const minimum = safeVersions[0] ?? "";
        const latest = safeVersions.at(-1) ?? "";

        lines.push(`✅ Safe upgrade available`);
        lines.push("");
        lines.push(`  Minimum safe version: ${minimum}`);
        if (minimum !== latest) {
          lines.push(`  Latest safe version:  ${latest}`);
        }
        lines.push("");

        if (latestVulns.length > 0 && safeVersions.at(-1) !== latestVersion) {
          lines.push(`⚠️  Latest version (${latestVersion}) still has ${latestVulns.length} known vuln(s).`);
          lines.push(`   Recommended: upgrade to ${latest}`);
        } else {
          lines.push(`💡 Recommended: upgrade to ${latest}`);
        }

        // Show how many versions were skipped as unsafe
        const unsafeCount = toCheck.filter((_, i) => (vulnResults[i]?.length ?? 0) > 0).length;
        if (unsafeCount > 0) {
          lines.push(`   (${unsafeCount} intermediate version(s) skipped — still vulnerable)`);
        }
      }

      lines.push("");
      lines.push("Source: OSV.dev + deps.dev");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
