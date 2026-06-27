export interface ParsedDep {
  name: string;
  version: string;
  ecosystem: "npm" | "pypi" | "cargo" | "go" | "rubygems" | "pub";
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
  if (base === "Gemfile.lock") return parseGemfileLock(content);
  if (base === "pubspec.lock") return parsePubspecLock(content);

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
  const packages = json.packages as
    | Record<string, { version?: string; dev?: boolean }>
    | undefined;

  if (packages) {
    for (const [key, val] of Object.entries(packages)) {
      if (!key || key === "") continue;
      if (!val.version) continue;

      const name = key.replace(/^.*node_modules\//, "");

      if (name) {
        deps.push({
          name,
          version: val.version,
          ecosystem: "npm",
        });
      }
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
    if (val.version) {
      out.push({
        name,
        version: val.version,
        ecosystem: "npm",
      });
    }

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
    if (
      !line.startsWith(" ") &&
      !line.startsWith("#") &&
      line.includes("@") &&
      line.endsWith(":")
    ) {
      const first = line.split(",")[0]?.trim().replace(/:$/, "") ?? "";

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
        deps.push({
          name: currentName,
          version: match[1],
          ecosystem: "npm",
        });

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

  for (const line of lines) {
    const v9Match = /^ {2}((?:@[^@/]+\/)?[^@/][^@]*)@([^:(@]+):/.exec(line);

    if (v9Match?.[1] && v9Match[2]) {
      deps.push({
        name: v9Match[1],
        version: v9Match[2],
        ecosystem: "npm",
      });

      continue;
    }

    const v6Match = /^ {2}\/((?:@[^/]+\/)?[^/]+)\/([^/:(@]+):/.exec(line);

    if (v6Match?.[1] && v6Match[2]) {
      deps.push({
        name: v6Match[1],
        version: v6Match[2],
        ecosystem: "npm",
      });
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

    if (!line || line.startsWith("-")) {
      continue;
    }

    const eqMatch = /^([A-Za-z0-9_.-]+)==?=?([^\s;]+)/.exec(line);

    if (eqMatch?.[1] && eqMatch[2]) {
      deps.push({
        name: eqMatch[1].toLowerCase(),
        version: eqMatch[2],
        ecosystem: "pypi",
      });
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
      if (name && version) {
        deps.push({
          name,
          version,
          ecosystem: "cargo",
        });
      }

      name = null;
      version = null;
      inPackage = true;
    } else if (inPackage) {
      const nameMatch = /^name\s*=\s*"([^"]+)"/.exec(line);

      if (nameMatch?.[1]) {
        name = nameMatch[1];
      }

      const verMatch = /^version\s*=\s*"([^"]+)"/.exec(line);

      if (verMatch?.[1]) {
        version = verMatch[1];
      }
    }
  }

  if (name && version) {
    deps.push({
      name,
      version,
      ecosystem: "cargo",
    });
  }

  return deps;
}

// ---------------------------------------------------------------------------
// go.sum
// ---------------------------------------------------------------------------
function parseGoSum(content: string): ParsedDep[] {
  const seen = new Set<string>();
  const deps: ParsedDep[] = [];

  for (const line of content.split("\n")) {
    const match = /^(\S+)\s+v([^\s/]+)/.exec(line);

    if (match?.[1] && match[2]) {
      const key = `${match[1]}@${match[2]}`;

      if (!seen.has(key)) {
        seen.add(key);

        deps.push({
          name: match[1],
          version: match[2],
          ecosystem: "go",
        });
      }
    }
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Gemfile.lock
// ---------------------------------------------------------------------------
function parseGemfileLock(content: string): ParsedDep[] {
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
          /^(.+)-(x86_64|arm64|aarch64|universal|java|mingw32|mswin32|x64_mingw32)(?:-[a-z0-9_]+)?$/i.exec(
            version,
          );

        if (platformMatch?.[1]) {
          version = platformMatch[1];
        }

        deps.push({
          name: match[1],
          version,
          ecosystem: "rubygems",
        });
      }
    }
  }

  return deps;
}

// ---------------------------------------------------------------------------
// pubspec.lock (Dart/Flutter)
// ---------------------------------------------------------------------------
function parsePubspecLock(content: string): ParsedDep[] {
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

    if (!inPackages) {
      continue;
    }

    const nameMatch = /^ {2}(\S+):/.exec(line);

    if (nameMatch?.[1]) {
      currentName = nameMatch[1];
      currentSource = null;
      continue;
    }

    if (!currentName) {
      continue;
    }

    const sourceMatch = /^ {4}source:\s+"?([^\s"]+)"?/.exec(line);

    if (sourceMatch?.[1]) {
      currentSource = sourceMatch[1];
      continue;
    }

    const versionMatch = /^ {4}version:\s+"?([^\s"]+)"?/.exec(line);

    if (versionMatch?.[1]) {
      if (currentSource !== "sdk") {
        deps.push({
          name: currentName,
          version: versionMatch[1],
          ecosystem: "pub",
        });
      }

      currentName = null;
      currentSource = null;
    }
  }

  return deps;
}