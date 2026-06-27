import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { getVersion } from "../api/depsdev.js";
import { COPYLEFT_LICENSES, NETWORK_COPYLEFT } from "../constants/licenses.js";
import { parseLockfile } from "../parsers/index.js";
import type { Ecosystem } from "../types/index.js";
import { formatUnsupportedLockfileMessage } from "../utils/lockfileFormat.js";

// Licenses allowed under each policy
const POLICY_ALLOWLISTS: Record<"permissive" | "copyleft", Set<string>> = {
  permissive: new Set([
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "0BSD",
    "Unlicense",
    "CC0-1.0",
    "BlueOak-1.0.0",
    "Python-2.0",
  ]),
  copyleft: new Set([
    "MIT",
    "ISC",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "Apache-2.0",
    "0BSD",
    "Unlicense",
    "CC0-1.0",
    "BlueOak-1.0.0",
    "Python-2.0",
    "LGPL-2.0",
    "LGPL-2.1",
    "LGPL-3.0",
    "MPL-2.0",
    "EPL-1.0",
    "EPL-2.0",
    "GPL-2.0",
    "GPL-2.0-only",
    "GPL-2.0-or-later",
    "GPL-3.0",
    "GPL-3.0-only",
    "GPL-3.0-or-later",
    "CDDL-1.0",
    "OSL-3.0",
  ]),
};

function classifyLicense(
  license: string,
): "permissive" | "weak-copyleft" | "copyleft" | "network-copyleft" | "unknown" {
  if (NETWORK_COPYLEFT.has(license)) return "network-copyleft";

  if (COPYLEFT_LICENSES.has(license)) {
    if (
      license.startsWith("LGPL") ||
      license === "MPL-2.0" ||
      license === "EPL-1.0" ||
      license === "EPL-2.0" ||
      license === "CDDL-1.0"
    ) {
      return "weak-copyleft";
    }

    return "copyleft";
  }

  if (POLICY_ALLOWLISTS.permissive.has(license)) return "permissive";

  return "unknown";
}

const MAX_FETCH = 50;

export function register(server: McpServer) {
  return server.registerTool(
    "hound_license_check",
    {
      description:
        "Scan a lockfile for license compliance. Resolves licenses for every dependency and flags packages that violate the chosen policy (permissive, copyleft, or none).",
      inputSchema: {
        lockfile_content: z.string().describe("Full text content of the lockfile"),

        // pubspec.lock is intentionally omitted here because deps.dev does not
        // support the Pub ecosystem. The handler below returns an explicit message.
        lockfile_name: z
          .string()
          .describe(
            "Filename: package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, go.sum, Gemfile.lock",
          ),

        policy: z
          .enum(["permissive", "copyleft", "none"])
          .default("permissive")
          .describe(
            "License policy to enforce: 'permissive' (MIT/Apache/BSD only), 'copyleft' (allows GPL but not AGPL), 'none' (report only, no violations)",
          ),
      },
    },
    async ({ lockfile_content, lockfile_name, policy }) => {
      const deps = parseLockfile(lockfile_name, lockfile_content);

      if (deps === null) {
        return {
          content: [
            {
              type: "text",
              text: formatUnsupportedLockfileMessage(lockfile_name),
            },
          ],
        };
      }

      // Pub dependencies can be parsed, but deps.dev cannot resolve their licenses.
      if (deps.some((dep) => dep.ecosystem === "pub")) {
        return {
          content: [
            {
              type: "text",
              text: "License checking for pubspec.lock is not currently supported because deps.dev does not support the Pub ecosystem.",
            },
          ],
        };
      }

      if (deps.length === 0) {
        return {
          content: [{ type: "text", text: `No dependencies found in ${lockfile_name}.` }],
        };
      }

      // Deduplicate
      const seen = new Set<string>();

      const unique = deps.filter((dep) => {
        const key = `${dep.name}@${dep.version}`;

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      });

      const toFetch = unique.slice(0, MAX_FETCH);
      const truncated = unique.length > MAX_FETCH;

      // Fetch licenses in parallel and ignore individual request failures.
      const licenseResults = await Promise.allSettled(
        toFetch.map((dep) => getVersion(dep.ecosystem as Ecosystem, dep.name, dep.version)),
      );

      interface LicenseResult {
        name: string;
        version: string;
        licenses: string[];
        classification: string;
        flagged: boolean;
        reason: string;
      }

      const allowlist = policy !== "none" ? POLICY_ALLOWLISTS[policy] : null;
      const results: LicenseResult[] = [];
      const licenseCount: Record<string, number> = {};

      for (let index = 0; index < toFetch.length; index++) {
        const dep = toFetch[index];

        if (!dep) continue;

        const result = licenseResults[index];
        const licenses =
          result?.status === "fulfilled" ? (result.value.licenses ?? []) : [];

        // Count each license.
        for (const license of licenses) {
          licenseCount[license] = (licenseCount[license] ?? 0) + 1;
        }

        // Determine whether the package violates the selected policy.
        let flagged = false;
        let reason = "";

        if (licenses.length === 0) {
          flagged = policy !== "none";
          reason = "License unknown";
        } else if (allowlist) {
          const violating = licenses.filter((license) => !allowlist.has(license));

          if (violating.length > 0) {
            flagged = true;
            reason = `License not allowed under ${policy} policy: ${violating.join(", ")}`;
          }
        }

        const classification =
          licenses.length === 0
            ? "unknown"
            : licenses.map(classifyLicense).join(", ");

        if (
          flagged ||
          licenses.some((license) => classifyLicense(license) !== "permissive")
        ) {
          results.push({
            name: dep.name,
            version: dep.version,
            licenses,
            classification,
            flagged,
            reason,
          });
        }
      }

      const flagged = results.filter((result) => result.flagged);
      const infoOnly = results.filter((result) => !result.flagged);

      const lines: string[] = [
        "🔏 Hound License Check",
        "═".repeat(50),
        `Lockfile:  ${lockfile_name}`,
        `Policy:    ${policy}`,
        `Scanned:   ${toFetch.length} packages${
          truncated ? ` (first ${MAX_FETCH} of ${unique.length})` : ""
        }`,
        "",
      ];

      if (flagged.length === 0) {
        lines.push("✅ No license violations found");

        if (policy !== "none") {
          lines.push(`   All scanned packages comply with the ${policy} policy.`);
        }
      } else {
        lines.push(
          `⚠️  ${flagged.length} license violation${
            flagged.length === 1 ? "" : "s"
          } found`,
        );
        lines.push("─".repeat(50));

        for (const result of flagged) {
          const license =
            result.licenses.length > 0
              ? result.licenses.join(", ")
              : "unknown";

          lines.push(`  ${result.name}@${result.version}`);
          lines.push(`    License: ${license}`);
          lines.push(`    ${result.reason}`);
          lines.push("");
        }
      }

      if (infoOnly.length > 0) {
        lines.push("─".repeat(50));
        lines.push("Non-permissive licenses (not violations):");

        for (const result of infoOnly) {
          const license = result.licenses.join(", ");
          lines.push(`  ${result.name}@${result.version}  ${license}`);
        }

        lines.push("");
      }

      // Top licenses summary
      const topLicenses = Object.entries(licenseCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      if (topLicenses.length > 0) {
        lines.push("─".repeat(50));
        lines.push("License distribution:");

        for (const [license, count] of topLicenses) {
          lines.push(`  ${String(count).padStart(4)}×  ${license}`);
        }

        lines.push("");
      }

      lines.push("Source: deps.dev");

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    },
  );
}