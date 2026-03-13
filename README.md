# Hound MCP

**The dependency bloodhound for AI coding agents.**

[![npm version](https://img.shields.io/npm/v/hound-mcp)](https://www.npmjs.com/package/hound-mcp)
[![npm downloads](https://img.shields.io/npm/dw/hound-mcp)](https://www.npmjs.com/package/hound-mcp)
[![CI](https://github.com/tiluckdave/hound-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/tiluckdave/hound-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

![Hound MCP Demo](demo/demo.gif)

## Why Hound?

AI coding agents recommend and install packages without knowing if they're safe — and most security tools require accounts, API keys, or paid plans to tell you. Hound fixes that: it scans for vulnerabilities, checks licenses, audits dependency trees, and detects typosquatting across 7 ecosystems — zero config, zero API keys, zero cost.

Hound is the only security tool built specifically for AI coding agents — works across npm, PyPI, Go, Cargo, Maven, NuGet, and RubyGems, and plugs into Claude Code, Cursor, VS Code, and any MCP client out of the box.

It uses two fully free, unauthenticated public APIs: **[deps.dev](https://deps.dev)** (Google Open Source Insights) and **[OSV](https://osv.dev)** (Google Open Source Vulnerabilities).

---

## Quickstart

### Claude Code

```bash
claude mcp add hound -- npx -y hound-mcp
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP config file:

```json
{
  "mcpServers": {
    "hound": {
      "command": "npx",
      "args": ["-y", "hound-mcp"]
    }
  }
}
```

### VS Code (Copilot)

```json
{
  "mcp": {
    "servers": {
      "hound": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "hound-mcp"]
      }
    }
  }
}
```

#### Config file locations

| Client | Config path |
| ------ | ----------- |
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

---

## Tools

12 tools → [Full reference with example outputs](docs/tools.md)

| Tool | What it does |
| ---- | ------------ |
| `hound_audit` ⭐ | Scan an entire lockfile for vulnerabilities across all dependencies |
| `hound_score` | 0–100 Hound Score (vulns + scorecard + recency + license) with letter grade |
| `hound_compare` | Side-by-side comparison of two packages with a recommendation |
| `hound_preinstall` | GO / CAUTION / NO-GO verdict before installing a package |
| `hound_upgrade` | Find the minimum safe version upgrade that resolves all known vulns |
| `hound_license_check` | Scan a lockfile for license compliance against a policy |
| `hound_vulns` | All known vulnerabilities for a package version, grouped by severity |
| `hound_inspect` | Full package profile — license, vulns, scorecard, stars, dep count |
| `hound_tree` | Full resolved dependency tree with transitive deps |
| `hound_typosquat` | Detect typosquatting variants of a package name |
| `hound_advisories` | Full advisory details by GHSA, CVE, or OSV ID |
| `hound_popular` | Scan popular packages for known vulnerabilities |

**Supported ecosystems:** `npm` · `pypi` · `go` · `maven` · `cargo` · `nuget` · `rubygems`

## Built-in Prompts

3 prompts you can invoke directly from your AI client. → [Full prompt reference](docs/prompts.md)

| Prompt | What it does |
| ------ | ------------ |
| `security_audit` | Full project security audit — vulns, licenses, typosquats |
| `package_evaluation` | Go/no-go recommendation before adding a new dependency |
| `pre_release_check` | Pre-ship dependency scan that flags release blockers |

## Use Cases

→ [See full examples with real lockfiles and expected output](examples/)

- **Before merging a PR** — scan the lockfile diff to catch newly introduced vulnerabilities before they land in main
- **Auditing an inherited codebase** — run `hound_audit` on an existing lockfile to get a full report in seconds
- **Checking a package before adding it** — use `hound_preinstall` to get a GO / CAUTION / NO-GO verdict
- **License compliance** — run `hound_license_check` to ensure no GPL or AGPL packages sneak into a commercial project
- **CI security gate** — ask your AI agent to run a security audit as part of every release check

---

## Local Development

```bash
git clone https://github.com/tiluckdave/hound-mcp.git
cd hound-mcp
pnpm install
pnpm build
pnpm test         # run tests
pnpm check        # typecheck + lint + test
```

## Roadmap

- [ ] **Docker support** — run Hound as a container for CI/CD pipelines
- [ ] **`bun.lockb` parser** — Bun lockfile support
- [ ] **`gradle.lockfile` parser** — Gradle (Java/Android) ecosystem support
- [ ] **`hound_diff` tool** — compare two lockfile snapshots to surface newly introduced risks
- [ ] **GitHub Action** — run `hound_audit` as a PR check without an AI agent

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

The one rule: **Hound must stay zero-config and free forever.** Don't add features that require API keys or accounts.

Good first issues are [labeled and ready](https://github.com/tiluckdave/hound-mcp/issues?q=is%3Aopen+label%3A%22good+first+issue%22).

---

## Community

💬 Questions or ideas? [Open a Discussion](https://github.com/tiluckdave/hound-mcp/discussions)

<a href="https://glama.ai/mcp/servers/tiluckdave/hound-mcp"><img width="120" src="https://glama.ai/mcp/servers/tiluckdave/hound-mcp/badge" alt="Glama MCP server" /></a>

## License

[MIT](LICENSE) © 2026 Tilak Dave
