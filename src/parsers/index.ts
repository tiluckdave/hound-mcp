import type { ParsedDep } from "./types";
import { parsePackageLock } from "./packageLock";
import { parseYarnLock } from "./yarnLock";
import { parsePnpmLock } from "./pnpmLock";
import { parseRequirements } from "./requirements";
import { parsePoetryLock } from "./poetryLock";
import { parseCargoLock } from "./cargoLock";
import { parseGoSum } from "./goSum";
import { parseGemfileLock } from "./gemfileLock";
import { parsePipfileLock } from "./pipfileLock";
import { parsePubspecLock } from "./pubspecLock";

const registry: Record<string, (content: string) => ParsedDep[]> = {
  "package-lock.json": parsePackageLock,
  "yarn.lock": parseYarnLock,
  "pnpm-lock.yaml": parsePnpmLock,
  "requirements.txt": parseRequirements,
  "poetry.lock": parsePoetryLock,
  "Cargo.lock": parseCargoLock,
  "go.sum": parseGoSum,
  "Gemfile.lock": parseGemfileLock,
  "Pipfile.lock": parsePipfileLock,
  "pubspec.lock": parsePubspecLock,
};

export function parseLockfile(filename: string, content: string): ParsedDep[] | null {
  const base = filename.split("/").pop() ?? filename;
  const parser = registry[base];
  return parser ? parser(content) : null;
}
