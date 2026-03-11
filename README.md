# Hound MCP

**The dependency bloodhound for AI coding agents.**

Hound is a free, open-source MCP server that gives AI coding agents a nose for supply chain security. It scans packages for vulnerabilities, checks licenses, inspects dependency trees, and detects typosquatting — with **zero API keys, zero config, and zero cost**.

[![npm version](https://img.shields.io/npm/v/hound-mcp)](https://www.npmjs.com/package/hound-mcp)
[![CI](https://github.com/tiluckdave/hound-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/tiluckdave/hound-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Why Hound?

Most security tools require accounts, API keys, or paid plans. Hound uses only two fully free, unauthenticated public APIs:

- **[deps.dev](https://deps.dev)** (Google Open Source Insights) — package metadata, dependency trees, licenses, OpenSSF Scorecard
- **[OSV](https://osv.dev)** (Google Open Source Vulnerabilities) — CVEs, GHSAs, fix versions

No sign-up. No config. Just install and go.

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

**Config file locations:**

- Claude Desktop (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
- Cursor: `~/.cursor/mcp.json`
- Windsurf: `~/.codeium/windsurf/mcp_config.json`

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

---

## Tools

Hound registers 6 tools in your MCP client.

### `hound_vulns`

List all known vulnerabilities for a package version, grouped by severity with fix versions.

```text
hound_vulns(name: "express", version: "4.18.2", ecosystem: "npm")
```

### `hound_inspect`

Comprehensive package profile — licenses, vulnerabilities, OpenSSF Scorecard, GitHub stars, and dependency count in one call.

```text
hound_inspect(name: "lodash", version: "4.17.21", ecosystem: "npm")
```

### `hound_tree`

Full resolved dependency tree including all transitive dependencies, with depth and relation type.

```text
hound_tree(name: "next", version: "14.2.0", ecosystem: "npm", maxDepth: 3)
```

### `hound_advisories`

Full advisory details by ID — works with GHSA, CVE, and OSV IDs.

```text
hound_advisories(id: "GHSA-rv95-896h-c2vc")
hound_advisories(id: "CVE-2024-29041")
```

### `hound_typosquat`

Generates likely typo variants of a package name and checks which ones exist in the registry — surfaces potential typosquatting attacks.

```text
hound_typosquat(name: "lodash", ecosystem: "npm")
```

### `hound_popular`

Scan a list of popular (or user-specified) packages for known vulnerabilities. Great for a quick ecosystem health check.

```text
hound_popular(ecosystem: "npm")
hound_popular(ecosystem: "pypi", packages: ["requests", "flask", "django"])
```

---

## Supported Ecosystems

| Ecosystem    | Value      |
| ------------ | ---------- |
| npm          | `npm`      |
| PyPI         | `pypi`     |
| Go           | `go`       |
| Maven        | `maven`    |
| Cargo (Rust) | `cargo`    |
| NuGet (.NET) | `nuget`    |
| RubyGems     | `rubygems` |

---

## Built-in Prompts

Hound ships with 3 MCP prompts you can invoke directly from your AI client.

### `security_audit`

Full project security audit — scans for vulnerabilities, license issues, and typosquat risks.

```text
/security_audit ecosystem="npm"
```

### `package_evaluation`

Go/no-go recommendation before adding a new dependency.

```text
/package_evaluation package="axios" version="1.6.0" ecosystem="npm"
```

### `pre_release_check`

Pre-ship dependency scan that flags release blockers.

```text
/pre_release_check version="1.2.0"
```

---

## Local Development

```bash
# Clone
git clone https://github.com/tiluckdave/hound-mcp.git
cd hound-mcp

# Install
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint

# Format
pnpm format

# Run all checks (typecheck + lint + test)
pnpm check

# Run locally as MCP server
node dist/index.js
```

---

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first — the one rule is **zero API keys, forever**. Hound must always work without any account or authentication.

---

## License

[MIT](LICENSE) © 2026 Tilak Dave
