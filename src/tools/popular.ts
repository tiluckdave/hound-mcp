import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { getPackage } from "../api/depsdev.js";
import { queryVulnsBatch } from "../api/osv.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import type { Ecosystem } from "../types/index.js";

/**
 * Curated list of widely-used packages per ecosystem.
 * Used as defaults when the user doesn't specify a list.
 */
const POPULAR_DEFAULTS: Record<string, string[]> = {
  npm: [
    "express",
    "lodash",
    "axios",
    "react",
    "typescript",
    "webpack",
    "eslint",
    "jest",
    "next",
    "vue",
  ],
  pypi: [
    "requests",
    "numpy",
    "pandas",
    "flask",
    "django",
    "fastapi",
    "sqlalchemy",
    "pytest",
    "boto3",
    "pydantic",
  ],
  go: [
    "github.com/gin-gonic/gin",
    "github.com/gorilla/mux",
    "github.com/stretchr/testify",
    "github.com/spf13/cobra",
    "go.uber.org/zap",
  ],
  maven: [
    "com.google.guava:guava",
    "org.springframework:spring-core",
    "org.apache.commons:commons-lang3",
    "com.fasterxml.jackson.core:jackson-databind",
    "org.slf4j:slf4j-api",
  ],
  cargo: ["serde", "tokio", "reqwest", "clap", "anyhow", "log", "rand", "regex"],
  nuget: [
    "Newtonsoft.Json",
    "Microsoft.Extensions.Logging",
    "Serilog",
    "AutoMapper",
    "FluentValidation",
  ],
  rubygems: ["rails", "devise", "rspec-core", "activerecord", "sidekiq"],
};

export function register(server: McpServer) {
  return server.registerTool(
    "hound_popular",
    {
      description:
        "Scan a list of popular (or user-specified) packages for known vulnerabilities. Quickly surface which widely-used packages in an ecosystem have open security issues.",
      inputSchema: {
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
        packages: z
          .array(z.string())
          .optional()
          .describe(
            "Specific package names to check. If omitted, uses a curated list of popular packages for the ecosystem.",
          ),
      },
    },
    async ({ ecosystem, packages }) => {
      const eco = ecosystem as Ecosystem;
      const names = packages ?? POPULAR_DEFAULTS[ecosystem] ?? [];

      if (names.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No packages specified and no defaults available for ${ecosystem}.`,
            },
          ],
        };
      }

      const packageResults = await Promise.allSettled(
        names.map(async (name) => {
          const pkg = await getPackage(eco, name);
          const defaultVersion = pkg.versions.find((v) => v.isDefault) ?? pkg.versions[0];
          return {
            name,
            version: defaultVersion?.versionKey.version ?? "unknown",
          };
        }),
      );

      const resolved = packageResults
        .map((r, i) => ({
          name: names[i] ?? "",
          version: r.status === "fulfilled" ? r.value.version : null,
        }))
        .filter((p): p is { name: string; version: string } => p.version !== null);

      const failed = packageResults.filter((r) => r.status === "rejected").length;

      const vulnResults = await queryVulnsBatch(
        resolved.map((p) => ({ ecosystem: eco, name: p.name, version: p.version })),
      );

      const lines: string[] = [
        `🔍 Vulnerability scan: ${ecosystem} popular packages`,
        "═".repeat(50),
        `Checked ${resolved.length} packages`,
        "",
      ];

      // Sort: vulnerable first, then clean
      const withVulns = resolved
        .map((pkg, i) => ({ ...pkg, vulns: vulnResults[i] ?? [] }))
        .sort((a, b) => b.vulns.length - a.vulns.length);

      const vulnerableCount = withVulns.filter((p) => p.vulns.length > 0).length;

      if (vulnerableCount === 0) {
        lines.push(`✅ All ${resolved.length} packages are clean — no known vulnerabilities.`);
        lines.push("");
      } else {
        lines.push(`⚠️  ${vulnerableCount} of ${resolved.length} packages have vulnerabilities:`);
        lines.push("");
      }

      for (const pkg of withVulns) {
        if (pkg.vulns.length === 0) {
          lines.push(`  ✅ ${pkg.name}@${pkg.version}`);
        } else {
          lines.push(`  ⚠️  ${pkg.name}@${pkg.version} — ${pkg.vulns.length} vuln(s)`);
          // Show vuln IDs (up to 3)
          for (const v of pkg.vulns.slice(0, 3)) {
            lines.push(`      ${v.id}: ${v.summary}`);
          }
          if (pkg.vulns.length > 3) {
            lines.push(`      ... and ${pkg.vulns.length - 3} more`);
          }
        }
      }

      if (failed > 0) {
        lines.push("");
        lines.push(`ℹ️  ${failed} package(s) could not be resolved in ${ecosystem}.`);
      }

      lines.push("");
      lines.push("Source: OSV.dev + deps.dev");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
