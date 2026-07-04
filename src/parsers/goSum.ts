import type { ParsedDep } from "./types";

export function parseGoSum(content: string): ParsedDep[] {
  const seen = new Set<string>();
  const deps: ParsedDep[] = [];
  for (const line of content.split("\n")) {
    const match = /^(\S+)\s+v([^\s/]+)/.exec(line);
    if (match?.[1] && match[2]) {
      const key = `${match[1]}@${match[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        deps.push({ name: match[1], version: match[2], ecosystem: "go" });
      }
    }
  }
  return deps;
}
