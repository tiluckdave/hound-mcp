import type { ParsedDep } from "./types";

export function parseRequirements(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.split("#")[0]?.trim() ?? "";
    if (!line || line.startsWith("-")) continue;
    const eqMatch = /^([A-Za-z0-9_.-]+)==?=?([^\s;]+)/.exec(line);
    if (eqMatch?.[1] && eqMatch[2]) {
      deps.push({ name: eqMatch[1].toLowerCase(), version: eqMatch[2], ecosystem: "pypi" });
    }
  }
  return deps;
}
