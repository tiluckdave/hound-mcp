import type { ParsedDep } from "./types";

export function parsePipfileLock(content: string): ParsedDep[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps: ParsedDep[] = [];
  for (const section of ["default", "develop"]) {
    const packages = json[section] as Record<string, { version?: string }> | undefined;
    if (!packages) continue;
    for (const [name, val] of Object.entries(packages)) {
      if (!val.version) continue;
      const version = val.version.replace(/^==/, "");
      deps.push({ name, version, ecosystem: "pypi" });
    }
  }
  return deps;
}
