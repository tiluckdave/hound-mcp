import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function securityAuditRegisterPrompt(server: McpServer): void {
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
}
