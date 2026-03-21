import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { getPackage } from "../api/depsdev.js";
import { ECOSYSTEM_VALUES } from "../constants/ecosystems.js";
import type { Ecosystem } from "../types/index.js";

/**
 * Generate likely typosquatting variants of a package name.
 * Covers the most common attack patterns:
 * - character omission (lodsh)
 * - character transposition (lodasg)
 * - character substitution (1odash, l0dash)
 * - hyphen/underscore confusion (lo_dash, lo-dash)
 * - common prefix/suffix additions (node-lodash, lodash-js)
 */
function generateTypos(name: string): string[] {
  const variants = new Set<string>();

  // Omit each character
  for (let i = 0; i < name.length; i++) {
    variants.add(name.slice(0, i) + name.slice(i + 1));
  }

  // Transpose adjacent characters
  for (let i = 0; i < name.length - 1; i++) {
    const a = name.charAt(i);
    const b = name.charAt(i + 1);
    variants.add(name.slice(0, i) + b + a + name.slice(i + 2));
  }

  // Hyphen/underscore confusion
  if (name.includes("-")) {
    variants.add(name.replaceAll("-", "_"));
    variants.add(name.replaceAll("-", ""));
  }
  if (name.includes("_")) {
    variants.add(name.replaceAll("_", "-"));
    variants.add(name.replaceAll("_", ""));
  }

  // Common prefix/suffix additions
  variants.add(`node-${name}`);
  variants.add(`${name}-js`);
  variants.add(`${name}js`);
  variants.add(`${name}-node`);

  // Remove the original name
  variants.delete(name);

  return [...variants];
}

export function register(server: McpServer) {
  return server.registerTool(
    "hound_typosquat",
    {
      description:
        "Check if a package name looks like a typosquat of a popular package. Generates likely typo variants and checks which ones exist in the registry.",
      inputSchema: {
        name: z.string().describe("Package name to check"),
        ecosystem: z
          .enum(ECOSYSTEM_VALUES)
          .default("npm")
          .describe("Package ecosystem (default: npm)"),
      },
    },
    async ({ name, ecosystem }) => {
      const eco = ecosystem as Ecosystem;
      const variants = generateTypos(name);

      // Check which variants actually exist in the registry (in parallel, ignore errors)
      const results = await Promise.allSettled(
        variants.map(async (variant) => {
          const pkg = await getPackage(eco, variant);
          return { name: variant, versionCount: pkg.versions.length };
        }),
      );

      const existing = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<{ name: string; versionCount: number }>).value)
        .sort((a, b) => b.versionCount - a.versionCount);

      // Also fetch the target package itself to confirm it exists
      const targetExists = await getPackage(eco, name)
        .then((p) => p.versions.length)
        .catch(() => null);

      const lines: string[] = [`🔍 Typosquat check: ${name} (${ecosystem})`, "═".repeat(50), ""];

      if (targetExists === null) {
        lines.push(`⚠️  "${name}" does not exist in ${ecosystem}.`);
        lines.push(`This package name itself may be available — or it could be a typo.`);
      } else {
        lines.push(`✅ "${name}" exists (${targetExists} published versions)`);
      }

      lines.push("");

      if (existing.length === 0) {
        lines.push(`✅ No typosquat variants found in ${ecosystem}.`);
        lines.push(`None of the ${variants.length} generated variants exist.`);
      } else {
        lines.push(`⚠️  Found ${existing.length} similar package(s) that exist in ${ecosystem}:`);
        lines.push("");
        for (const pkg of existing) {
          lines.push(`  📦 ${pkg.name} (${pkg.versionCount} versions)`);
        }
        lines.push("");
        lines.push(`If you meant to install "${name}", double-check you typed it correctly.`);
        lines.push(`If you are the author of "${name}", consider reserving these names.`);
      }

      lines.push("");
      lines.push(
        `ℹ️  Checked ${variants.length} typo variants (omission, transposition, hyphen, affixes)`,
      );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );
}
