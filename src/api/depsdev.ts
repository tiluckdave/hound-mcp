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
    headers: { "User-Agent": `hound-mcp/${__APP_VERSION__}` },
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
 * Retrieves metadata for a specific package version from the deps.dev API.
 *
 * Includes information such as licenses, advisory references,
 * related projects, publication date, and version details.
 *
 * @param ecosystem - The package ecosystem (npm, pypi, go, maven, cargo, nuget, or rubygems).
 * @param name - The package name.
 * @param version - The specific package version to retrieve.
 * @returns Detailed metadata for the specified package version.
 * @throws {DepsDevError} When the package version cannot be found or the API request fails.
 *
 * @example
 * const version = await getVersion("npm", "express", "4.18.2");
 * console.log(version.licenses);
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
 * Retrieves metadata for a package and all available versions.
 *
 * Useful for exploring package history and identifying upgrade targets.
 *
 * @param ecosystem - The package ecosystem.
 * @param name - The package name.
 * @returns Package metadata including version information.
 * @throws {DepsDevError} When the package cannot be found or the API request fails.
 *
 * @example
 * const pkg = await getPackage("npm", "express");
 * console.log(pkg.versions.length);
 */
export async function getPackage(ecosystem: Ecosystem, name: string): Promise<DepsDevPackage> {
  const sys = ECOSYSTEM_MAP[ecosystem];
  return get<DepsDevPackage>(`/systems/${sys}/packages/${encodeURIComponent(name)}`);
}

/**
 * Retrieves the fully resolved dependency graph for a package version.
 *
 * The response contains dependency nodes and dependency edges,
 * allowing traversal of direct and transitive dependencies.
 *
 * @param ecosystem - The package ecosystem.
 * @param name - The package name.
 * @param version - The package version.
 * @returns Dependency graph containing nodes and edges.
 * @throws {DepsDevError} When dependency information cannot be retrieved.
 *
 * @example
 * const deps = await getDependencies("npm", "express", "4.18.2");
 * console.log(deps.nodes.length);
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
 * Retrieves project metadata and OpenSSF Scorecard information.
 *
 * Project identifiers are typically source repository paths such as
 * github.com/owner/repository.
 *
 * @param projectId - Project identifier in the format "github.com/owner/repo".
 * @returns Project metadata including stars, forks, license information,
 * description, homepage, and scorecard data.
 * @throws {DepsDevError} When the project cannot be found or the API request fails.
 *
 * @example
 * const project = await getProject("github.com/expressjs/express");
 * console.log(project.starsCount);
 */
export async function getProject(projectId: string): Promise<DepsDevProject> {
  const encoded = projectId.replaceAll("/", "%2F");
  return get<DepsDevProject>(`/projects/${encoded}`);
}

/**
 * Retrieves advisory details from deps.dev using an advisory identifier.
 *
 * Advisory records include severity information, aliases,
 * vulnerability references, and CVSS data.
 *
 * @param advisoryId - Advisory identifier such as a GHSA ID.
 * @returns Advisory details associated with the provided identifier.
 * @throws {DepsDevError} When the advisory cannot be found or the API request fails.
 *
 * @example
 * const advisory = await getAdvisory("GHSA-rv95-896h-c2vc");
 * console.log(advisory.title);
 */
export async function getAdvisory(advisoryId: string): Promise<DepsDevAdvisory> {
  return get<DepsDevAdvisory>(`/advisories/${encodeURIComponent(advisoryId)}`);
}

/**
 * Extracts a source repository or issue tracker project identifier
 * from a package version's related projects list.
 *
 * The function returns the first SOURCE_REPO or ISSUE_TRACKER entry found.
 *
 * @param version - Package version metadata returned by deps.dev.
 * @returns Project identifier if available; otherwise null.
 *
 * @example
 * const projectId = extractProjectId(version);
 * console.log(projectId);
 */
export function extractProjectId(version: DepsDevVersion): string | null {
  const related = version.relatedProjects ?? [];
  const sourceRepo = related.find(
    (r) => r.relationType === "SOURCE_REPO" || r.relationType === "ISSUE_TRACKER",
  );
  return sourceRepo?.projectKey.id ?? null;
}
