import type { ParsedDep } from "./types";

export function parsePoetryLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  let name: string | null = null;
  let version: string | null = null;
  let inPackage = false;

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "[[package]]") {
      if (name && version) deps.push({ name, version, ecosystem: "pypi" });
      name = null; version = null; inPackage = true;
    } else if (line.startsWith("[") && line.endsWith("]")) {
      if (name && version) deps.push({ name, version, ecosystem: "pypi" });
      name = null; version = null; inPackage = false;
    } else if (inPackage) {
      const nameMatch = /^name\s*=\s*"([^"]+)"/.exec(line);
      if (nameMatch?.[1]) name = nameMatch[1];
      const verMatch = /^version\s*=\s*"([^"]+)"/.exec(line);
      if (verMatch?.[1]) version = verMatch[1];
    }
  }
  if (name && version) deps.push({ name, version, ecosystem: "pypi" });
  return deps;
}
