export interface ParsedDep {
  name: string;
  version: string;
  ecosystem: "npm" | "pypi" | "cargo" | "go" | "rubygems" | "pub";
}
