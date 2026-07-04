// src/constants/lockfiles.ts
export const SUPPORTED_LOCKFILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "requirements.txt",
  "poetry.lock",
  "Cargo.lock",
  "go.sum",
  "Gemfile.lock",
  "pubspec.lock",
  "Pipfile.lock"
] as const;

export type SupportedLockfile = typeof SUPPORTED_LOCKFILES[number];
