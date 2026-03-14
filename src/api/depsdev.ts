/**
 * Client for the deps.dev API (Google Open Source Insights).
 *
 * Base URL: https://api.deps.dev/v3/
 * Auth: none
 * Docs: https://deps.dev/about
 *
 * Ecosystem names in URLs must be uppercase (NPM, PYPI, GO, MAVEN, CARGO, NUGET, RUBYGEMS).
 * Project keys use %2F encoding for slashes (github.com%2Fowner%2Frepo).
 */

import type { Ecosystem } from "../types/index.js";

const BASE_URL = "https://api.deps.dev/v3";

const ECOSYSTEM_MAP: Record<Ecosystem, string> = {
  npm: "npm",
  pypi: "pypi",
  go: "go",
  maven: "maven",
  cargo: "cargo",
  nuget: "nuget",
  rubygems: "rubygems",
};

export interface DepsDevVersionKey {
  system: string;
  name: string;
  version: string;
}

export interface DepsDevAdvisoryKey {
  id: string;
}

export interface DepsDevLink {
  label: string;
  url: string;
}

export interface DepsDevRelatedProject {
  projectKey: { id: string };
  relationProvenance: string;
  relationType: string;
}

export interface DepsDevVersion {
  versionKey: DepsDevVersionKey;
  publishedAt: string;
  isDefault: boolean;
  licenses?: string[];
  advisoryKeys?: DepsDevAdvisoryKey[];
  links?: DepsDevLink[];
  relatedProjects?: DepsDevRelatedProject[];
}

export interface DepsDevPackage {
  packageKey: { system: string; name: string };
  versions: {
    versionKey: DepsDevVersionKey;
    publishedAt: string;
    isDefault: boolean;
  }[];
}

export interface DepsDevDepNode {
  versionKey: DepsDevVersionKey;
  bundled: boolean;
  relation: "SELF" | "DIRECT" | "INDIRECT";
  errors: string[];
}

export interface DepsDevDepEdge {
  fromNode: number;
  toNode: number;
  requirement: string;
}

export interface DepsDevDependencies {
  nodes: DepsDevDepNode[];
  edges: DepsDevDepEdge[];
}

export interface DepsDevScorecardCheck {
  name: string;
  score: number;
  reason: string;
  details: string[];
}

export interface DepsDevScorecard {
  date: string;
  repository: { name: string; commit: string };
  overallScore: number;
  checks: DepsDevScorecardCheck[];
}

export interface DepsDevProject {
  projectKey: { id: string };
  openIssuesCount: number;
  starsCount: number;
  forksCount: number;
  license: string;
  description: string;
  homepage: string;
  scorecard: DepsDevScorecard | null;
}

export interface DepsDevAdvisory {
  advisoryKey: { id: string };
  url: string;
  title: string;
  aliases: string[];
  cvss3Score: number;
  cvss3Vector: string;
}

async function get<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "hound-mcp/0.1.0" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DepsDevError(res.status, url, body);
  }

  return res.json() as Promise<T>;
}

export class DepsDevError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`deps.dev API error ${status} for ${url}`);
    this.name = "DepsDevError";
  }
}

/**
 * Get metadata for a specific package version.
 * Includes licenses, advisory keys, and related project links.
 */
export async function getVersion(
  ecosystem: Ecosystem,
  name: string,
  version: string,
): Promise<DepsDevVersion> {
  const sys = ECOSYSTEM_MAP[ecosystem];
  return get<DepsDevVersion>(
    `/systems/${sys}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`,
  );
}

/**
 * Get all versions of a package.
 * Useful for finding available upgrade targets.
 */
export async function getPackage(ecosystem: Ecosystem, name: string): Promise<DepsDevPackage> {
  const sys = ECOSYSTEM_MAP[ecosystem];
  return get<DepsDevPackage>(`/systems/${sys}/packages/${encodeURIComponent(name)}`);
}

/**
 * Get the full resolved dependency graph for a package version.
 * Returns nodes (packages) and edges (dependency relationships).
 * relationType: SELF = the package itself, DIRECT = direct deps, INDIRECT = transitive deps.
 */
export async function getDependencies(
  ecosystem: Ecosystem,
  name: string,
  version: string,
): Promise<DepsDevDependencies> {
  const sys = ECOSYSTEM_MAP[ecosystem];
  return get<DepsDevDependencies>(
    `/systems/${sys}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}:dependencies`,
  );
}

/**
 * Get project metadata and OpenSSF Scorecard for a GitHub/GitLab project.
 * projectId format: "github.com/owner/repo"
 */
export async function getProject(projectId: string): Promise<DepsDevProject> {
  const encoded = projectId.replaceAll("/", "%2F");
  return get<DepsDevProject>(`/projects/${encoded}`);
}

/**
 * Get full advisory details by advisory ID (e.g. "GHSA-rv95-896h-c2vc").
 */
export async function getAdvisory(advisoryId: string): Promise<DepsDevAdvisory> {
  return get<DepsDevAdvisory>(`/advisories/${encodeURIComponent(advisoryId)}`);
}

/**
 * Extract the GitHub/GitLab project ID from a version's relatedProjects list.
 * Returns the first SOURCE_REPO or ISSUE_TRACKER project ID found, or null.
 */
export function extractProjectId(version: DepsDevVersion): string | null {
  const related = version.relatedProjects ?? [];
  const sourceRepo = related.find(
    (r) => r.relationType === "SOURCE_REPO" || r.relationType === "ISSUE_TRACKER",
  );
  return sourceRepo?.projectKey.id ?? null;
}
