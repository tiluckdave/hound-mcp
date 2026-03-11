# Hound MCP — CLAUDE.md

## Project Overview

**Hound** is a free, open-source MCP server that gives AI coding agents a nose for supply chain security. It scans dependency trees, audits lockfiles, scores package health, and detects vulnerabilities — with zero API keys and zero config.

**Tagline:** "The dependency bloodhound for AI coding agents"

**Target users:** Individual developers, open source contributors, enterprises, and businesses who want supply chain security without paying for Snyk or other commercial tools.

**Core value proposition:** Forever free. No API keys. Zero config. Just `npx hound-mcp`.

---

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 18+
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Transport:** stdio (primary)
- **HTTP Client:** Native `fetch`
- **Validation:** Zod
- **Build:** tsup
- **Testing:** Vitest
- **Linting:** Biome
- **Package Manager:** pnpm
- **Registry:** npm (as `hound-mcp`)

---

## Data Sources (Free, Zero Auth)

- **deps.dev API** — `https://api.deps.dev/v3/` — package metadata, dependency trees, licenses, OpenSSF Scorecard
- **OSV API** — `https://api.osv.dev/v1/` — vulnerability records, batch querying, severity scores

---

## Project Structure

```sh
hound-mcp/
├── src/
│   ├── index.ts              # Entry point, stdio transport
│   ├── server.ts             # MCP server setup, tool registration
│   ├── tools/
│   │   ├── audit.ts          # hound_audit (hero tool)
│   │   ├── compare.ts        # hound_compare
│   │   ├── preinstall.ts     # hound_preinstall
│   │   ├── license-check.ts  # hound_license_check
│   │   ├── upgrade.ts        # hound_upgrade
│   │   ├── score.ts          # hound_score
│   │   ├── inspect.ts        # hound_inspect
│   │   ├── vulns.ts          # hound_vulns
│   │   ├── tree.ts           # hound_tree
│   │   ├── typosquat.ts      # hound_typosquat
│   │   ├── advisories.ts     # hound_advisories
│   │   └── popular.ts        # hound_popular
│   ├── parsers/
│   │   ├── package-lock.ts   # npm lockfile parser
│   │   ├── yarn-lock.ts      # yarn.lock parser
│   │   ├── pnpm-lock.ts      # pnpm-lock.yaml parser
│   │   ├── requirements.ts   # pip requirements.txt parser
│   │   ├── cargo-lock.ts     # Cargo.lock parser
│   │   └── go-sum.ts         # go.sum parser
│   ├── api/
│   │   ├── depsdev.ts        # deps.dev API client
│   │   └── osv.ts            # OSV API client
│   ├── scoring/
│   │   └── hound-score.ts    # Risk scoring algorithm
│   └── types/
│       └── index.ts          # Shared types
├── tests/
├── CLAUDE.md
├── README.md
├── LICENSE                   # MIT
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── biome.json
```

---

## MCP Tools (12 Tools, 3 Tiers)

### Tier 1 — Computed Intelligence (the novel layer)

1. `hound_audit` — **HERO TOOL** — scans lockfile, returns full risk report
2. `hound_compare` — side-by-side package comparison with verdict
3. `hound_preinstall` — go/no-go safety check before installing a package
4. `hound_license_check` — full dep tree license compliance analysis
5. `hound_upgrade` — finds minimal safe version bump for a vulnerable package
6. `hound_score` — 0-100 health score with A-F letter grade

### Tier 2 — Enriched Lookups

1. `hound_inspect` — comprehensive package profile
2. `hound_vulns` — vulnerabilities grouped by severity with fix versions
3. `hound_tree` — full transitive dependency tree with stats

### Tier 3 — Utilities

1. `hound_typosquat` — detects if a package name looks like a typosquat
2. `hound_advisories` — full advisory details by ID
3. `hound_popular` — dependent count as popularity/impact signal

### MCP Prompts (3 built-in)

- `security_audit` — full project security audit
- `package_evaluation` — health assessment for a candidate package
- `pre_release_check` — pre-ship dependency scan

---

## Supported Lockfile Formats

- `package-lock.json` (npm)
- `yarn.lock` (yarn)
- `pnpm-lock.yaml` (pnpm)
- `requirements.txt` (pip/PyPI)
- `Cargo.lock` (Rust)
- `go.sum` (Go)

---

## Coding Conventions

- TypeScript strict mode — no `any`, no implicit types
- Each tool lives in its own file under `src/tools/`
- Each lockfile parser lives in its own file under `src/parsers/`
- All API calls go through clients in `src/api/` — never call fetch directly in tools
- Use Zod for all input validation in tool schemas
- Error responses must be human-readable strings, never raw stack traces
- Tool outputs are formatted text (not JSON blobs) — AI agents and humans both read them
- Keep tools focused — each tool does one thing well
- Batch API calls where possible (OSV batch endpoint) to minimize latency

---

## Development Phases

### Phase 1 — MVP (current focus)

- [ ] Project scaffolding (pnpm, tsup, vitest, biome)
- [ ] deps.dev API client
- [ ] OSV API client
- [ ] 4 core tools: `hound_inspect`, `hound_vulns`, `hound_tree`, `hound_score`
- [ ] npx support working end-to-end
- [ ] Basic README

### Phase 2 — The Novel Layer

- [ ] Lockfile parsers (package-lock.json first)
- [ ] `hound_audit` (hero tool)
- [ ] `hound_compare`, `hound_preinstall`, `hound_license_check`, `hound_upgrade`
- [ ] Hound Score algorithm
- [ ] Built-in MCP prompts

### Phase 3 — Polish & Launch

- [ ] Demo GIF / video
- [ ] README engineering (banner, badges, novelty matrix)
- [ ] Publish to npm as `hound-mcp`
- [ ] Submit to MCP directories (12 directories)

---

## Key Design Decisions

1. **stdio transport first** — runs locally on user's machine, reads lockfiles directly from filesystem. No server needed, no data leaks.
2. **Zero auth** — deps.dev and OSV are both free, public, unauthenticated APIs. We never ask for API keys.
3. **Human-readable output** — tool outputs are formatted text reports, not raw JSON. Optimized for AI agents consuming them as context.
4. **Lockfile as source of truth** — we read the actual resolved dependency tree, not just what's in `package.json`.
5. **Batch queries** — use OSV's batch endpoint to scan all deps in one call, not N serial calls.

---

## Open Source Principles

- License: MIT (forever free, no CLA)
- Contributions welcome — keep the zero-API-key constraint
- Never add features that require users to create accounts or provide keys
- "Free forever" is the brand — do not add paid tiers that gate security features

---

## Installation (for testing)

```bash
# Development
pnpm install
pnpm build
node dist/index.js

# Via npx (once published)
npx hound-mcp

# Claude Code
claude mcp add hound -- npx -y hound-mcp

# Claude Desktop / Cursor
{
  "mcpServers": {
    "hound": {
      "command": "npx",
      "args": ["-y", "hound-mcp"]
    }
  }
}
```

---

## Common Commands

```bash
pnpm build          # compile TypeScript via tsup
pnpm dev            # watch mode
pnpm test           # run vitest
pnpm lint           # run biome check
pnpm lint:fix       # run biome check --write
pnpm typecheck      # tsc --noEmit
```

---

## Security Notes

- This project handles lockfile content — never execute or eval any lockfile data
- API responses from deps.dev and OSV are external data — validate before use
- Never store or log user lockfile content
- The typosquat tool shows similar package names for informational purposes only — never auto-install anything
