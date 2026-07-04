import type { ParsedDep } from "./types";

export function parsePnpmLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const v9Match = /^ {2}((?:@[^@/]+\/)?[^@/][^@]*)@([^:(@]+):/.exec(line);
    if (v9Match?.[1] && v9Match[2]) {
      deps.push({ name: v9Match[1], version: v9Match[2], ecosystem: "npm" });
      continue;
    }
    const v6Match = /^ {2}\/((?:@[^/]+\/)?[^/]+)\/([^/:(@]+):/.exec(line);
    if (v6Match?.[1] && v6Match[2]) {
      deps.push({ name: v6Match[1], version: v6Match[2], ecosystem: "npm" });
    }
  }
  return deps;
}
