import type { ParsedDep } from "./types";

export function parsePackageLock(content: string): ParsedDep[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps: ParsedDep[] = [];

  const packages = json.packages as Record<string, { version?: string }> | undefined;
  if (packages) {
    for (const [key, val] of Object.entries(packages)) {
      if (!val.version) continue;
      const name = key.replace(/^.*node_modules\//, "");
      if (name) deps.push({ name, version: val.version, ecosystem: "npm" });
    }
    return deps;
  }

  const dependencies = json.dependencies as Record<string, { version?: string; dependencies?: unknown }> | undefined;
  if (dependencies) collectNpmV1(dependencies, deps);

  return deps;
}

function collectNpmV1(
  deps: Record<string, { version?: string; dependencies?: unknown }>,
  out: ParsedDep[],
): void {
  for (const [name, val] of Object.entries(deps)) {
    if (val.version) out.push({ name, version: val.version, ecosystem: "npm" });
    if (val.dependencies) collectNpmV1(val.dependencies as Record<string, { version?: string; dependencies?: unknown }>, out);
  }
}
