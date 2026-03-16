import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function preReleaseCheckRegisterPrompt(server: McpServer): void {
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
