import { SUPPORTED_LOCKFILES } from "../parsers/index.js";

export function formatSupportedLockfileNames(licenseCheckOnly = false): string {
  return SUPPORTED_LOCKFILES.filter(
    ({ supportsLicenseCheck }) => !licenseCheckOnly || supportsLicenseCheck,
  )
    .map(({ filename }) => filename)
    .join(", ");
}

export function suggestLockfile(input: string): string | null {
  const normalized = input.toLowerCase();

  for (const { filename, patterns } of SUPPORTED_LOCKFILES) {
    if (patterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
      return filename;
    }
  }

  return null;
}

export function formatUnsupportedLockfileMessage(input: string): string {
  const suggestion = suggestLockfile(input);
  const lines = [`Unsupported lockfile format: ${input}`, ""];

  if (suggestion) {
    lines.push(`Did you mean: ${suggestion}?`, "");
  }

  lines.push(
    "Supported formats:",
    ...SUPPORTED_LOCKFILES.map(({ filename, ecosystem }) => `  - ${filename} (${ecosystem})`),
  );

  return lines.join("\n");
}
