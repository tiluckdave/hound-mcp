import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function packageEvaluationRegisterPrompt(server: McpServer): void {
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
}
