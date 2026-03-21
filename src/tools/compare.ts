import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { extractProjectId, getPackage, getProject, getVersion } from "../api/depsdev.js";
import { extractSeverity, queryVulns } from "../api/osv.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import { COPYLEFT_LICENSES } from "../constants/licenses.js";
import type { Ecosystem } from "../types/index.js";
import { getDefaultVersion } from "../utils/getDefaultVersion.js";

interface PackageData {
  name: string;
  version: string;
  vulnCounts: Record<string, number>;
  totalVulns: number;
  scorecardScore: number | null;
  stars: number | null;
  daysSince: number;
  licenses: string[];
  projectExists: boolean;
}

async function gatherPackageData(eco: Ecosystem, name: string): Promise<PackageData | null> {
  // Get package to find default version
  let defaultVersion: string;
  try {
    const pkg = await getPackage(eco, name);
    const defaultV = getDefaultVersion(pkg.versions);
    if (!defaultV) return null;
    defaultVersion = defaultV.versionKey.version;
  } catch {
    return null;
  }

  const [versionResult, vulnsResult] = await Promise.allSettled([
    getVersion(eco, name, defaultVersion),
    queryVulns(eco, name, defaultVersion),
  ]);

  if (versionResult.status === "rejected") return null;

  const version = versionResult.value;
  const vulns = vulnsResult.status === "fulfilled" ? vulnsResult.value : [];

  const vulnCounts: Record<string, number> = {};
  for (const v of vulns) {
    const sev = extractSeverity(v);
    vulnCounts[sev] = (vulnCounts[sev] ?? 0) + 1;
  }

  const projectId = extractProjectId(version);
  const projectData = projectId !== null ? await getProject(projectId).catch(() => null) : null;

  const daysSince = Math.floor(
    (Date.now() - new Date(version.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    name,
    version: defaultVersion,
    vulnCounts,
    totalVulns: vulns.length,
    scorecardScore: projectData?.scorecard?.overallScore ?? null,
    stars: projectData?.starsCount ?? null,
    projectExists: projectData !== null,
    daysSince,
    licenses: version.licenses ?? [],
  };
}

function licenseRisk(licenses: string[]): string {
  if (licenses.length === 0) return "Unknown";
  if (licenses.some((l) => COPYLEFT_LICENSES.has(l))) return "Copyleft";
  return "Permissive";
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function winner(a: number, b: number, higherIsBetter = true): [string, string] {
  if (a === b) return ["", ""];
  const aWins = higherIsBetter ? a > b : a < b;
  return aWins ? ["✓", ""] : ["", "✓"];
}

export function register(server: McpServer) {
  return server.registerTool(
    "hound_compare",
    {
      description:
        "Side-by-side comparison of two packages: vulnerabilities, OpenSSF Scorecard, GitHub stars, release recency, and license. Returns a recommendation.",
      inputSchema: {
        package_a: z.string().describe("First package name"),
        package_b: z.string().describe("Second package name"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
      },
    },
    async ({ package_a, package_b, ecosystem }) => {
      const eco = ecosystem as Ecosystem;

      const [dataA, dataB] = await Promise.all([
        gatherPackageData(eco, package_a),
        gatherPackageData(eco, package_b),
      ]);

      if (!dataA && !dataB) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find either ${package_a} or ${package_b} in ${ecosystem}.`,
            },
          ],
        };
      }
      if (!dataA) {
        return {
          content: [
            { type: "text", text: `Could not find ${package_a} in ${ecosystem}.` },
          ],
        };
      }
      if (!dataB) {
        return {
          content: [
            { type: "text", text: `Could not find ${package_b} in ${ecosystem}.` },
          ],
        };
      }

      const COL = 22;
      const header = (label: string) =>
        `${pad(label, 24)}${pad(dataA.name, COL)}${pad(dataB.name, COL)}`;

      const row = (label: string, valA: string, valB: string, wA = "", wB = "") =>
        `  ${pad(label, 22)}${pad(wA ? `${valA} ${wA}` : valA, COL)}${wB ? `${valB} ${wB}` : valB}`;

      const lines: string[] = [
        `⚖️  Package Comparison (${ecosystem})`,
        "═".repeat(70),
        header(""),
        header("Metric"),
        "─".repeat(70),
      ];

      // Version
      lines.push(row("Latest version", dataA.version, dataB.version));

      // Vulnerabilities
      const vulnA = dataA.totalVulns === 0 ? "None" : `${dataA.totalVulns} vuln(s)`;
      const vulnB = dataB.totalVulns === 0 ? "None" : `${dataB.totalVulns} vuln(s)`;
      const [wVA, wVB] = winner(dataA.totalVulns, dataB.totalVulns, false);
      lines.push(row("Vulnerabilities", vulnA, vulnB, wVA, wVB));

      // Critical/High breakdown if any vulns
      if (dataA.totalVulns > 0 || dataB.totalVulns > 0) {
        const critA = (dataA.vulnCounts.CRITICAL ?? 0) + (dataA.vulnCounts.HIGH ?? 0);
        const critB = (dataB.vulnCounts.CRITICAL ?? 0) + (dataB.vulnCounts.HIGH ?? 0);
        lines.push(row("  Critical/High", String(critA), String(critB)));
      }

      // Scorecard
      const scA = dataA.scorecardScore !== null ? dataA.scorecardScore.toFixed(1) : "N/A";
      const scB = dataB.scorecardScore !== null ? dataB.scorecardScore.toFixed(1) : "N/A";
      const [wSA, wSB] =
        dataA.scorecardScore !== null && dataB.scorecardScore !== null
          ? winner(dataA.scorecardScore, dataB.scorecardScore)
          : ["", ""];
      lines.push(row("OpenSSF Scorecard", scA, scB, wSA, wSB));

      // Stars
      const stA = dataA.stars !== null ? dataA.stars.toLocaleString() : "N/A";
      const stB = dataB.stars !== null ? dataB.stars.toLocaleString() : "N/A";
      const [wStA, wStB] =
        dataA.stars !== null && dataB.stars !== null
          ? winner(dataA.stars, dataB.stars)
          : ["", ""];
      lines.push(row("GitHub stars", stA, stB, wStA, wStB));

      // Recency
      const recA = `${dataA.daysSince}d ago`;
      const recB = `${dataB.daysSince}d ago`;
      const [wRA, wRB] = winner(dataA.daysSince, dataB.daysSince, false);
      lines.push(row("Last release", recA, recB, wRA, wRB));

      // License
      const licA = dataA.licenses.length > 0 ? dataA.licenses.join(", ") : "Unknown";
      const licB = dataB.licenses.length > 0 ? dataB.licenses.join(", ") : "Unknown";
      lines.push(row("License", licA, licB));
      lines.push(row("License risk", licenseRisk(dataA.licenses), licenseRisk(dataB.licenses)));

      // Recommendation
      lines.push("");
      lines.push("─".repeat(70));
      lines.push("Recommendation");
      lines.push("─".repeat(30));

      let scoreA = 0;
      let scoreB = 0;

      // Fewer vulns is better
      if (dataA.totalVulns < dataB.totalVulns) scoreA += 2;
      else if (dataB.totalVulns < dataA.totalVulns) scoreB += 2;

      // Higher scorecard is better
      if (dataA.scorecardScore !== null && dataB.scorecardScore !== null) {
        if (dataA.scorecardScore > dataB.scorecardScore) scoreA++;
        else if (dataB.scorecardScore > dataA.scorecardScore) scoreB++;
      }

      // More stars is better
      if (dataA.stars !== null && dataB.stars !== null) {
        if (dataA.stars > dataB.stars) scoreA++;
        else if (dataB.stars > dataA.stars) scoreB++;
      }

      // More recent is better
      if (dataA.daysSince < dataB.daysSince) scoreA++;
      else if (dataB.daysSince < dataA.daysSince) scoreB++;

      // Permissive license is better
      const lrA = licenseRisk(dataA.licenses);
      const lrB = licenseRisk(dataB.licenses);
      if (lrA === "Permissive" && lrB !== "Permissive") scoreA++;
      else if (lrB === "Permissive" && lrA !== "Permissive") scoreB++;

      if (scoreA > scoreB) {
        lines.push(`✅ Prefer ${dataA.name} — leads on ${scoreA} of 6 criteria`);
      } else if (scoreB > scoreA) {
        lines.push(`✅ Prefer ${dataB.name} — leads on ${scoreB} of 6 criteria`);
      } else {
        lines.push(`🤝 Both packages are roughly equivalent (${scoreA}/${scoreB} criteria)`);
      }

      lines.push("");
      lines.push("Source: OSV.dev + deps.dev");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
