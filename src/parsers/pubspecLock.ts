import type { ParsedDep } from "./types";

export function parsePubspecLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const lines = content.split("\n");

  let inPackages = false;
  let currentName: string | null = null;
  let currentSource: string | null = null;

  for (const line of lines) {
    if (line.startsWith("packages:")) {
      inPackages = true;
      continue;
    }
    if (line.startsWith("sdks:")) {
      inPackages = false;
      currentName = null;
      currentSource = null;
      continue;
    }
    if (!inPackages) continue;

    const nameMatch = /^ {2}(\S+):/.exec(line);
    if (nameMatch?.[1]) {
      currentName = nameMatch[1];
      currentSource = null;
      continue;
    }
    if (!currentName) continue;

    const sourceMatch = /^ {4}source:\s+"?([^\s"]+)"?/.exec(line);
    if (sourceMatch?.[1]) {
      currentSource = sourceMatch[1];
      continue;
    }
    const versionMatch = /^ {4}version:\s+"?([^\s"]+)"?/.exec(line);
    if (versionMatch?.[1]) {
      if (currentSource !== "sdk") {
        deps.push({ name: currentName, version: versionMatch[1], ecosystem: "pub" });
      }
      currentName = null;
      currentSource = null;
    }
  }
  return deps;
}
