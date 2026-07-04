import type { ParsedDep } from "./types";

export function parseGemfileLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const lines = content.split("\n");
  let inGemSection = false;
  let inSpecs = false;

  for (const line of lines) {
    if (line.startsWith("GEM")) {
      inGemSection = true;
      inSpecs = false;
      continue;
    }
    if (line.length > 0 && !line.startsWith(" ")) {
      inGemSection = false;
      inSpecs = false;
      continue;
    }
    if (inGemSection && line.trim() === "specs:") {
      inSpecs = true;
      continue;
    }
    if (inSpecs) {
      const match = /^ {4}([A-Za-z0-9_.-]+)\s+\(([^\s)]+)\)/.exec(line);
      if (match?.[1] && match[2]) {
        let version = match[2];
        const platformMatch =
          /^(.+)-(x86_64|arm64|aarch64|universal|java|mingw32|mswin32|x64_mingw32)(?:-[a-z0-9_]+)?$/i.exec(version);
        if (platformMatch?.[1]) version = platformMatch[1];
        deps.push({ name: match[1], version, ecosystem: "rubygems" });
      }
    }
  }
  return deps;
}
