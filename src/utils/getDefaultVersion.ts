import type { DepsDevVersionKey } from "../api/depsdev.js";

interface VersionEntry {
  versionKey: DepsDevVersionKey;
  isDefault: boolean;
}

/**
 * Pick the default version from a deps.dev versions array.
 * Prefers the entry with `isDefault: true`, falls back to the last entry.
 * Returns undefined if the array is empty.
 */
export function getDefaultVersion<T extends VersionEntry>(versions: T[]): T | undefined {
  return versions.find((v) => v.isDefault) ?? versions.at(-1);
}
