/**
 * Client for the OSV API (Google Open Source Vulnerabilities).
 *
 * Base URL: https://api.osv.dev/v1/
 * Auth: none
 * Docs: https://google.github.io/osv.dev/api/
 *
 * Ecosystem names use OSV convention (npm, PyPI, Go, Maven, crates.io, NuGet, RubyGems).
 */

import type { Ecosystem, Severity } from "../types/index.js";

const BASE_URL = "https://api.osv.dev/v1";

const ECOSYSTEM_MAP: Record<Ecosystem, string> = {
  npm: "npm",
  pypi: "PyPI",
  go: "Go",
  maven: "Maven",
  cargo: "crates.io",
  nuget: "NuGet",
  rubygems: "RubyGems",
};

export interface OsvSeverityEntry {
  type: "CVSS_V2" | "CVSS_V3" | "CVSS_V4";
  score: string; // CVSS vector string e.g. "CVSS:3.1/AV:N/..."
}

export interface OsvRange {
  type: "SEMVER" | "ECOSYSTEM" | "GIT";
  events: (
    | { introduced: string; fixed?: undefined; last_affected?: undefined }
    | { fixed: string; introduced?: undefined; last_affected?: undefined }
    | { last_affected: string; introduced?: undefined; fixed?: undefined }
  )[];
}

export interface OsvAffected {
  package: {
    name: string;
    ecosystem: string;
    purl?: string;
  };
  ranges: OsvRange[];
  versions?: string[];
  database_specific?: Record<string, unknown>;
}

export interface OsvDatabaseSpecific {
  severity?: string; // "LOW" | "MODERATE" | "HIGH" | "CRITICAL"
  nvd_published_at?: string;
  github_reviewed?: boolean;
  github_reviewed_at?: string;
  cwe_ids?: string[];
}

export interface OsvVuln {
  id: string;
  summary: string;
  details?: string;
  aliases?: string[];
  modified: string;
  published: string;
  references?: { type: string; url: string }[];
  affected: OsvAffected[];
  severity?: OsvSeverityEntry[];
  database_specific?: OsvDatabaseSpecific;
  schema_version?: string;
}

export interface OsvQueryResponse {
  vulns?: OsvVuln[];
}

export interface OsvBatchResponse {
  results: OsvQueryResponse[];
}

async function post<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "hound-mcp/0.1.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OsvError(res.status, url, text);
  }

  return res.json() as Promise<TResponse>;
}

export class OsvError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`OSV API error ${status} for ${url}`);
    this.name = "OsvError";
  }
}

/**
 * Query vulnerabilities for a single package@version.
 * Returns an empty array if no vulnerabilities are found.
 */
export async function queryVulns(
  ecosystem: Ecosystem,
  name: string,
  version: string,
): Promise<OsvVuln[]> {
  const response = await post<OsvQueryResponse>("/query", {
    version,
    package: {
      name,
      ecosystem: ECOSYSTEM_MAP[ecosystem],
    },
  });
  return response.vulns ?? [];
}

/**
 * Query vulnerabilities for multiple packages in a single API call.
 * Returns results in the same order as the input packages array.
 * Packages with no vulnerabilities return an empty array.
 */
export async function queryVulnsBatch(
  packages: { ecosystem: Ecosystem; name: string; version: string }[],
): Promise<OsvVuln[][]> {
  if (packages.length === 0) return [];

  const response = await post<OsvBatchResponse>("/querybatch", {
    queries: packages.map((pkg) => ({
      version: pkg.version,
      package: {
        name: pkg.name,
        ecosystem: ECOSYSTEM_MAP[pkg.ecosystem],
      },
    })),
  });

  return response.results.map((result) => result.vulns ?? []);
}

/**
 * Fetch full vulnerability details by OSV/GHSA ID.
 */
export async function getVuln(vulnId: string): Promise<OsvVuln> {
  const url = `${BASE_URL}/vulns/${encodeURIComponent(vulnId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "hound-mcp/0.1.0" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OsvError(res.status, url, text);
  }

  return res.json() as Promise<OsvVuln>;
}

/**
 * Extract a human-readable severity level from an OSV vulnerability.
 * Prefers database_specific.severity, falls back to parsing CVSS score.
 */
export function extractSeverity(vuln: OsvVuln): Severity {
  // Prefer the GitHub advisory database severity label
  const dbSeverity = vuln.database_specific?.severity?.toUpperCase();
  if (dbSeverity === "CRITICAL") return "CRITICAL";
  if (dbSeverity === "HIGH") return "HIGH";
  if (dbSeverity === "MODERATE") return "MODERATE";
  if (dbSeverity === "LOW") return "LOW";

  // Fall back to CVSS score
  const cvssScore = extractCvssScore(vuln);
  if (cvssScore === null) return "UNKNOWN";
  if (cvssScore >= 9.0) return "CRITICAL";
  if (cvssScore >= 7.0) return "HIGH";
  if (cvssScore >= 4.0) return "MODERATE";
  return "LOW";
}

/**
 * Extract a numeric CVSS score from an OSV vulnerability.
 * Prefers CVSS_V3, falls back to V4, then V2.
 * Returns null if no CVSS score is available.
 */
export function extractCvssScore(vuln: OsvVuln): number | null {
  const entries = vuln.severity ?? [];
  const preferred = ["CVSS_V3", "CVSS_V4", "CVSS_V2"] as const;

  for (const type of preferred) {
    const entry = entries.find((e) => e.type === type);
    if (entry) {
      return parseCvssScore(entry.score);
    }
  }
  return null;
}

/**
 * Extract fix versions from an OSV affected range.
 * Returns a deduplicated list of versions that fix the vulnerability.
 */
export function extractFixVersions(vuln: OsvVuln, ecosystem: Ecosystem): string[] {
  const osvEcosystem = ECOSYSTEM_MAP[ecosystem];
  const fixed = new Set<string>();

  for (const affected of vuln.affected) {
    if (affected.package.ecosystem.toLowerCase() !== osvEcosystem.toLowerCase()) {
      continue;
    }
    for (const range of affected.ranges) {
      for (const event of range.events) {
        if ("fixed" in event && event.fixed) {
          fixed.add(event.fixed);
        }
      }
    }
  }

  return [...fixed];
}

function parseCvssScore(vector: string): number | null {
  // CVSS vectors look like "CVSS:3.1/AV:N/AC:L/..." — the base score is not
  // in the vector string itself. We can only get it if the API includes it
  // directly, which OSV doesn't. Return null and let callers use severity label.
  // This function is kept as a hook for future enrichment.
  void vector;
  return null;
}
