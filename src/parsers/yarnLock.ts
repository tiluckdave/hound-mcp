import type { ParsedDep } from "./types";

export function parseYarnLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const lines = content.split("\n");
  let currentName: string | null = null;

  for (const line of lines) {
    if (!line.startsWith(" ") && !line.startsWith("#") && line.includes("@") && line.endsWith(":")) {
      const first = line.split(",")[0]?.trim().replace(/:$/, "") ?? "";
      const atIdx = first.indexOf("@", first.startsWith("@") ? 1 : 0);
      currentName = atIdx > 0 ? first.slice(0, atIdx) : null;
    } else if (currentName) {
      const match = /^\s+version\s+"(.+)"/.exec(line);
      if (match?.[1]) {
        deps.push({ name: currentName, version: match[1], ecosystem: "npm" });
        currentName = null;
      }
    }
  }
  return deps;
}
