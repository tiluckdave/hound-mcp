interface SupportedLockfile {
  filename: string;
  ecosystem: string;
  patterns: string[];
}

const SUPPORTED_LOCKFILES: SupportedLockfile[] = [
  { filename: "package-lock.json", ecosystem: "npm", patterns: ["package"] },
  { filename: "yarn.lock", ecosystem: "npm/Yarn", patterns: ["yarn"] },
  { filename: "pnpm-lock.yaml", ecosystem: "npm/pnpm", patterns: ["pnpm"] },
  { filename: "requirements.txt", ecosystem: "Python/pip", patterns: ["requirements", "pip"] },
  { filename: "Cargo.lock", ecosystem: "Rust/Cargo", patterns: ["cargo"] },
  { filename: "go.sum", ecosystem: "Go", patterns: ["go.", "gosum"] },
  {
    filename: "Gemfile.lock",
    ecosystem: "Ruby/Bundler",
    patterns: ["gemfile", "bundle", "bundler"],
  },
];

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
