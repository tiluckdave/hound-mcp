/**
 * Shared types used across Hound tools, parsers, and API clients.
 */

// ---------------------------------------------------------------------------
// Ecosystems
// ---------------------------------------------------------------------------

export type Ecosystem = "npm" | "pypi" | "go" | "maven" | "cargo" | "nuget" | "rubygems";

// ---------------------------------------------------------------------------
// Parsed dependency (output of lockfile parsers)
// ---------------------------------------------------------------------------

export interface ParsedDependency {
  name: string;
  version: string;
  ecosystem: Ecosystem;
}

// ---------------------------------------------------------------------------
// Vulnerability (from OSV)
// ---------------------------------------------------------------------------

export type Severity = "CRITICAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";

export interface Vulnerability {
  id: string;
  summary: string;
  severity: Severity;
  cvssScore: number | null;
  fixedVersions: string[];
  references: string[];
  publishedAt: string;
}

// ---------------------------------------------------------------------------
// Package info (from deps.dev)
// ---------------------------------------------------------------------------

export interface PackageVersion {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  licenses: string[];
  publishedAt: string;
  isDefault: boolean;
  dependencyCount: number;
}

export interface ScorecardCheck {
  name: string;
  score: number; // 0-10
  reason: string;
}

export interface Scorecard {
  overallScore: number; // 0-10
  checks: ScorecardCheck[];
}

export interface ProjectInfo {
  name: string;
  description: string;
  homepage: string;
  stars: number;
  forks: number;
  openIssues: number;
  scorecard: Scorecard | null;
}

// ---------------------------------------------------------------------------
// Hound Score
// ---------------------------------------------------------------------------

export type LetterGrade = "A" | "B" | "C" | "D" | "F";

export interface HoundScore {
  total: number; // 0-100
  grade: LetterGrade;
  breakdown: {
    vulnerabilities: number; // 0-30 pts
    scorecard: number; // 0-25 pts
    freshness: number; // 0-20 pts
    popularity: number; // 0-15 pts
    license: number; // 0-10 pts
  };
}

// ---------------------------------------------------------------------------
// Tool result helpers
// ---------------------------------------------------------------------------

export interface ToolSuccess<T> {
  ok: true;
  data: T;
}

export interface ToolError {
  ok: false;
  error: string;
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;
