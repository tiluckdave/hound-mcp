export interface ParsedDep {
  name: string;
  version: string;
  ecosystem: "npm" | "pypi" | "cargo" | "go";
}

/**
 * Detect lockfile type from filename and parse dependencies.
 * Returns null if the format is unrecognised.
 */
export function parseLockfile(filename: string, content: string): ParsedDep[] | null {
  const base = filename.split("/").pop() ?? filename;

  if (base === "package-lock.json") return parsePackageLock(content);
  if (base === "yarn.lock") return parseYarnLock(content);
  if (base === "pnpm-lock.yaml") return parsePnpmLock(content);
  if (base === "requirements.txt") return parseRequirements(content);
  if (base === "Cargo.lock") return parseCargoLock(content);
  if (base === "go.sum") return parseGoSum(content);

  return null;
}

// ---------------------------------------------------------------------------
// package-lock.json (npm v2/v3 — "packages" field)
// ---------------------------------------------------------------------------
function parsePackageLock(content: string): ParsedDep[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps: ParsedDep[] = [];

  // v2/v3 format: "packages" object with keys like "node_modules/express"
  const packages = json.packages as Record<string, { version?: string; dev?: boolean }> | undefined;
  if (packages) {
    for (const [key, val] of Object.entries(packages)) {
      if (!key || key === "") continue; // skip root entry
      if (!val.version) continue;
      // Extract package name from path like "node_modules/foo" or "node_modules/@scope/foo"
      const name = key.replace(/^.*node_modules\//, "");
      if (name) deps.push({ name, version: val.version, ecosystem: "npm" });
    }
    return deps;
  }

  // v1 format: "dependencies" object (legacy)
  const dependencies = json.dependencies as
    | Record<string, { version?: string; requires?: unknown; dependencies?: unknown }>
    | undefined;
  if (dependencies) {
    collectNpmV1(dependencies, deps);
  }

  return deps;
}

function collectNpmV1(
  deps: Record<string, { version?: string; dependencies?: unknown }>,
  out: ParsedDep[],
): void {
  for (const [name, val] of Object.entries(deps)) {
    if (val.version) out.push({ name, version: val.version, ecosystem: "npm" });
    if (val.dependencies) {
      collectNpmV1(
        val.dependencies as Record<string, { version?: string; dependencies?: unknown }>,
        out,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// yarn.lock (classic v1 format)
// ---------------------------------------------------------------------------
function parseYarnLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const lines = content.split("\n");
  let currentName: string | null = null;

  for (const line of lines) {
    // Entry header: "package-name@range, package-name@range2:"
    if (!line.startsWith(" ") && !line.startsWith("#") && line.includes("@") && line.endsWith(":")) {
      // Extract package name from first specifier before the @version part
      const first = line.split(",")[0]?.trim().replace(/:$/, "") ?? "";
      // Handle scoped packages: @scope/name@range
      if (first.startsWith("@")) {
        const atIdx = first.indexOf("@", 1);
        currentName = atIdx > 0 ? first.slice(0, atIdx) : null;
      } else {
        const atIdx = first.indexOf("@");
        currentName = atIdx > 0 ? first.slice(0, atIdx) : null;
      }
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

// ---------------------------------------------------------------------------
// pnpm-lock.yaml (v6/v9)
// ---------------------------------------------------------------------------
function parsePnpmLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  const lines = content.split("\n");

  // v9 format: packages section has lines like:
  //   express@4.18.2:
  // v6 format: /express/4.18.2:
  for (const line of lines) {
    // v9: "  name@version:" at top level under "packages:"
    const v9Match = /^ {2}((?:@[^@/]+\/)?[^@/][^@]*)@([^:(@]+):/.exec(line);
    if (v9Match?.[1] && v9Match[2]) {
      deps.push({ name: v9Match[1], version: v9Match[2], ecosystem: "npm" });
      continue;
    }
    // v6: "  /name/version:" or "  /@scope/name/version:"
    const v6Match = /^ {2}\/((?:@[^/]+\/)?[^/]+)\/([^/:(@]+):/.exec(line);
    if (v6Match?.[1] && v6Match[2]) {
      deps.push({ name: v6Match[1], version: v6Match[2], ecosystem: "npm" });
    }
  }

  return deps;
}

// ---------------------------------------------------------------------------
// requirements.txt (pip)
// ---------------------------------------------------------------------------
function parseRequirements(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.split("#")[0]?.trim() ?? "";
    if (!line || line.startsWith("-")) continue;

    // name==version or name===version
    const eqMatch = /^([A-Za-z0-9_.-]+)==?=?([^\s;]+)/.exec(line);
    if (eqMatch?.[1] && eqMatch[2]) {
      deps.push({ name: eqMatch[1].toLowerCase(), version: eqMatch[2], ecosystem: "pypi" });
    }
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Cargo.lock (TOML-like)
// ---------------------------------------------------------------------------
function parseCargoLock(content: string): ParsedDep[] {
  const deps: ParsedDep[] = [];
  let name: string | null = null;
  let version: string | null = null;
  let inPackage = false;

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "[[package]]") {
      if (name && version) deps.push({ name, version, ecosystem: "cargo" });
      name = null;
      version = null;
      inPackage = true;
    } else if (inPackage) {
      const nameMatch = /^name\s*=\s*"([^"]+)"/.exec(line);
      if (nameMatch?.[1]) name = nameMatch[1];
      const verMatch = /^version\s*=\s*"([^"]+)"/.exec(line);
      if (verMatch?.[1]) version = verMatch[1];
    }
  }
  if (name && version) deps.push({ name, version, ecosystem: "cargo" });

  return deps;
}

// ---------------------------------------------------------------------------
// go.sum
// ---------------------------------------------------------------------------
function parseGoSum(content: string): ParsedDep[] {
  const seen = new Set<string>();
  const deps: ParsedDep[] = [];

  for (const line of content.split("\n")) {
    // format: module/path v1.2.3 h1:hash=
    // or:     module/path v1.2.3/go.mod h1:hash=
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
