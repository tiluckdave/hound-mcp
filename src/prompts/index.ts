import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function registerPrompts(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // security_audit — full project security audit workflow
  // ---------------------------------------------------------------------------
  server.registerPrompt(
    "security_audit",
    {
      description:
        "Run a full security audit on the current project's dependencies. Scans for vulnerabilities, license issues, and typosquat risks across your entire dependency tree.",
      argsSchema: {
        ecosystem: z
          .string()
          .optional()
          .describe("Package ecosystem (npm, pypi, cargo, etc). Auto-detected if omitted."),
      },
    },
    ({ ecosystem }) => {
      const ecoNote = ecosystem ? ` The project uses ${ecosystem}.` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please run a comprehensive security audit on this project's dependencies.${ecoNote}

Follow these steps:
1. Use \`hound_popular\` to check the most commonly used packages in this ecosystem for known vulnerabilities — this gives a quick baseline.
2. For any specific packages you can identify in the project, use \`hound_vulns\` to check each one for CVEs and advisories.
3. Use \`hound_inspect\` on the 3-5 most critical dependencies to check their licenses, OpenSSF Scorecard, and GitHub health.
4. For any package names that look unusual or unfamiliar, use \`hound_typosquat\` to check for potential typosquatting.
5. If any vulnerabilities are found, use \`hound_advisories\` to get full details and fix guidance.

Summarize findings as:
- **Critical / High** vulnerabilities that need immediate attention
- **License risks** (copyleft licenses, unknown licenses)
- **Health concerns** (abandoned packages, low Scorecard scores)
- **Recommended actions** with specific version upgrades where available`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // package_evaluation — evaluate a candidate package before adding it
  // ---------------------------------------------------------------------------
  server.registerPrompt(
    "package_evaluation",
    {
      description:
        "Evaluate a package before adding it as a dependency. Returns a go/no-go recommendation with security, license, and health analysis.",
      argsSchema: {
        package: z.string().describe("Package name to evaluate (e.g. express, requests, serde)"),
        version: z
          .string()
          .optional()
          .describe("Specific version to evaluate. Uses latest stable if omitted."),
        ecosystem: z.string().optional().describe("Package ecosystem. Defaults to npm if omitted."),
      },
    },
    ({ package: pkg, version, ecosystem }) => {
      const eco = ecosystem ?? "npm";
      const versionNote = version ? `version ${version} of ` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I'm considering adding ${versionNote}\`${pkg}\` (${eco}) as a dependency. Please evaluate it thoroughly.

Steps:
1. Use \`hound_inspect\` on \`${pkg}\`${version ? `@${version}` : ""} (ecosystem: ${eco}) to get the full health profile — licenses, vulnerabilities, OpenSSF Scorecard, GitHub stats.
2. Use \`hound_vulns\` to get the full vulnerability list with fix versions.
3. Use \`hound_typosquat\` to confirm this is the legitimate package and not a typosquat.
4. Use \`hound_tree\` to check the transitive dependency count — packages with hundreds of transitive deps carry more supply chain risk.
5. If any advisories are listed, use \`hound_advisories\` to get the details.

Give me a clear **GO / NO-GO / CONDITIONAL** recommendation with reasoning. If conditional, state exactly what version or conditions would make it acceptable.`,
            },
          },
        ],
      };
    },
  );

  // ---------------------------------------------------------------------------
  // pre_release_check — dependency scan before shipping
  // ---------------------------------------------------------------------------
  server.registerPrompt(
    "pre_release_check",
    {
      description:
        "Run a pre-release dependency scan before shipping. Checks for vulnerabilities and license issues that could block a release.",
      argsSchema: {
        version: z.string().optional().describe("The version you are about to release, e.g. 1.2.0"),
      },
    },
    ({ version }) => {
      const versionNote = version ? ` (version ${version})` : "";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I'm about to release this project${versionNote}. Run a pre-release dependency check.

Steps:
1. Use \`hound_popular\` to scan all key packages in this project's ecosystem for known vulnerabilities.
2. For any packages identified as critical to this project, use \`hound_vulns\` to check for vulnerabilities.
3. Use \`hound_inspect\` on the top 5 dependencies by importance to verify licenses are compatible and no advisories are outstanding.
4. Flag any HIGH or CRITICAL severity vulnerabilities as **release blockers**.
5. Flag any copyleft licenses (GPL, AGPL, LGPL) that may conflict with the project's MIT license as **license blockers**.

Output a release checklist:
- ✅ or ❌ Vulnerabilities (CRITICAL/HIGH)
- ✅ or ❌ License compatibility
- ✅ or ❌ No abandoned dependencies (last published >2 years ago)

End with a clear **SAFE TO RELEASE** or **BLOCKED — fix these issues first** verdict.`,
            },
          },
        ],
      };
    },
  );
}
