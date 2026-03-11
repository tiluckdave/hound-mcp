# 🐕 Hound

**Hound sniffs out vulnerabilities, license risks, and health issues in your dependencies — before they bite.**

> An MCP server that gives AI coding agents a nose for supply chain security.  
> Zero API keys. Zero config. Just `npx hound-mcp`.

---

## The Pitch (Why This Exists)

AI coding agents install packages on your behalf every day.  
They never check if those packages are safe.

Hound is the missing security layer between your AI agent and the package registry. It reads your actual project files, resolves the full dependency tree, and tells you what's hiding inside — vulnerabilities, license traps, abandoned maintainers, typosquatting.

No API key. No account. No config. It just works.

---

## What Makes Hound Novel (Not Just an API Wrapper)

deps.dev gives you package metadata. OSV gives you vulnerability records. But neither answers the question developers actually ask: **"Is my project safe?"**

Hound is the **brain between your codebase and the APIs**:

```
Your project (lockfiles, manifests)
              ↓
         🐕 Hound
    ┌──────────────────────┐
    │  Lockfile parsing     │ ← reads your actual project
    │  Tree resolution      │ ← walks every transitive dep
    │  Multi-API orchestr.  │ ← combines deps.dev + OSV
    │  Risk scoring engine  │ ← computes what no API gives
    │  License compliance   │ ← analyzes against your rules
    │  Upgrade pathfinding  │ ← finds minimal safe version
    └──────────────────────┘
         ↓            ↓
    deps.dev API    OSV API
    (metadata)    (vulns)
```

### The Novelty Matrix

| What Hound does | deps.dev alone | OSV alone | Both combined via Hound |
|---|---|---|---|
| "Scan my lockfile for vulns" | ❌ Can't read files | ❌ No batch from files | ✅ Parse → extract → batch query |
| "Risk score for a package" | ❌ Raw data only | ❌ Vulns only | ✅ Composite: vulns + scorecard + freshness + license + popularity |
| "Should I use X or Y?" | ❌ No compare | ❌ No compare | ✅ Side-by-side health comparison |
| "Is this safe to install?" | ❌ No verdict | ❌ No verdict | ✅ Pre-install safety check with typosquat detection |
| "License conflicts in my tree?" | ❌ Per-pkg only | ❌ No license data | ✅ Full tree license compliance analysis |
| "Smallest safe upgrade?" | ❌ No resolution | ❌ No upgrade logic | ✅ Walk versions, cross-check vulns, find minimum fix |

---

## Data Sources (Both Free, Zero Auth)

### deps.dev API (Google Open Source Insights)
- **URL:** `https://api.deps.dev/v3/` (stable, guaranteed)
- **Auth:** None
- **Rate limits:** None documented
- **Ecosystems:** npm, PyPI, Go, Maven, Cargo, NuGet, RubyGems
- **Gives us:** Package versions, resolved dependency trees, licenses, OpenSSF Scorecard, project metadata, dependent counts, similar package names

### OSV.dev API (Google Open Source Vulnerabilities)  
- **URL:** `https://api.osv.dev/v1/`
- **Auth:** None
- **Rate limits:** None documented
- **Ecosystems:** 20+ (all major ones)
- **Gives us:** Vulnerability records by package+version, batch querying, severity scores, affected version ranges, fix versions

---

## MCP Tools (12 Tools, 3 Tiers)

### Tier 1 — 🧠 Computed Intelligence (the novel stuff)

These tools don't exist anywhere else. They orchestrate, combine, and compute.

#### 1. `hound_audit`  ⭐ THE HERO TOOL
> "Scan my project for dependency risks"

Reads the user's lockfile → extracts every dependency + version → batch queries OSV for vulns → enriches each with deps.dev license/scorecard data → returns a prioritized risk report.

**Input:** lockfile path (or content)  
**Supports:** package-lock.json, yarn.lock, pnpm-lock.yaml, requirements.txt, Cargo.lock, go.sum  
**Output:**
```
📊 Hound Audit Report
─────────────────────
342 dependencies scanned
🔴 3 critical vulnerabilities
🟡 7 moderate vulnerabilities  
⚠️  4 packages with copyleft licenses (GPL/AGPL)
🪦 6 packages with no updates in 2+ years
📋 Full breakdown below...
```

#### 2. `hound_compare`
> "Should I use fastify or express?"

Pulls both packages' vuln history, OpenSSF scorecard, maintenance activity, license, dependent count. Returns a side-by-side verdict.

**Input:** two package names + ecosystem  
**Output:** comparison table with recommendation

#### 3. `hound_preinstall`
> "Is it safe to install this-package@2.1.0?"

The AI safety layer. Before installing, checks: known vulns? typosquatting risk? abandoned? license concern? Returns a go/no-go signal.

**Input:** package name + version + ecosystem  
**Output:** safety verdict with reasons

#### 4. `hound_license_check`
> "Any GPL dependencies in my project?"

Resolves full dependency tree via deps.dev → collects every license → flags conflicts against a target policy (e.g., "commercial-friendly", "permissive-only", or custom).

**Input:** lockfile path + policy (default: "permissive")  
**Output:** flagged packages with license + depth in tree

#### 5. `hound_upgrade`
> "Find the nearest safe version of lodash"

Given a vulnerable package@version, queries deps.dev for all versions → cross-checks each against OSV → finds the minimum version bump that resolves all known vulns.

**Input:** package + current version + ecosystem  
**Output:** recommended version + what it fixes

#### 6. `hound_score`
> "How healthy is this package?"

Computes a 0-100 Hound Score combining:
- Vulnerability count + severity (weighted)
- OpenSSF Scorecard (if available)
- Days since last release
- Dependent count (popularity signal)
- License risk level
- Maintainer count

**Input:** package + version + ecosystem  
**Output:** score breakdown with letter grade (A-F)

### Tier 2 — 🔍 Enriched Lookups (more than raw API)

These add formatting, context, and cross-referencing.

#### 7. `hound_inspect`
> "Tell me everything about express@4.18.2"

Package version details enriched with: license, vuln count, scorecard, GitHub stats, dependent count, all in one call.

**Input:** package + version + ecosystem  
**Output:** comprehensive package profile

#### 8. `hound_vulns`
> "What vulnerabilities affect react@17.0.2?"

Queries OSV, enriches with severity, fix versions, and advisory links. Groups by severity.

**Input:** package + version + ecosystem  
**Output:** vulnerability list grouped by severity

#### 9. `hound_tree`
> "Show me the dependency tree for fastify@4.0.0"

Fetches resolved transitive deps from deps.dev. Shows depth, count, and optionally flags any with known vulns.

**Input:** package + version + ecosystem + optional depth limit  
**Output:** dependency tree with stats

### Tier 3 — 🧰 Utilities

#### 10. `hound_typosquat`
> "Is this package name legit or a typosquat?"

Uses deps.dev's GetSimilarlyNamedPackages to check if a name looks suspiciously close to a popular package.

**Input:** package name + ecosystem  
**Output:** similar package names + popularity comparison

#### 11. `hound_advisories`
> "Give me details on GHSA-xxx-xxx"

Fetches full advisory details from deps.dev — affected versions, severity, patches, references.

**Input:** advisory ID  
**Output:** full advisory record

#### 12. `hound_popular`
> "How many packages depend on lodash?"

Quick dependents count — a popularity/impact signal.

**Input:** package + version + ecosystem  
**Output:** dependent count + context

---

## MCP Prompts (3 Built-in)

1. **`security_audit`**  
   "Run a full security audit on my project. Parse my lockfile, identify all vulnerabilities, flag license issues, and highlight abandoned packages."

2. **`package_evaluation`**  
   "I'm considering adding {package} to my project. Give me a complete health assessment — security, maintenance, license, popularity."

3. **`pre_release_check`**  
   "I'm about to ship. Scan my dependencies and tell me if there's anything that would block a production release."

---

## Tech Stack

```
Language:        TypeScript (strict mode)
Runtime:         Node.js 18+
MCP SDK:         @modelcontextprotocol/sdk
Transport:       stdio (primary) → Streamable HTTP (Phase 3)
HTTP Client:     Native fetch
Validation:      Zod
Build:           tsup
Testing:         Vitest
Linting:         Biome
Package Mgr:     pnpm
Registry:        npm (as `hound-mcp`)
```

---

## Project Structure

```
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
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── biome.json
├── LICENSE                    # MIT
└── README.md
```

---

## Development Phases

### Phase 1 — MVP (4-5 days)
- [ ] Project scaffolding (tsup, vitest, biome)
- [ ] deps.dev API client (GetPackage, GetVersion, GetDependencies, GetAdvisory, GetProject)
- [ ] OSV API client (query, querybatch, vulns)
- [ ] 4 core tools: `hound_inspect`, `hound_vulns`, `hound_tree`, `hound_score`
- [ ] npx support working
- [ ] Basic README with install instructions

### Phase 2 — The Novel Layer (4-5 days)
- [ ] Lockfile parsers (package-lock.json first, then others)
- [ ] `hound_audit` (the hero tool)
- [ ] `hound_compare`
- [ ] `hound_preinstall`
- [ ] `hound_license_check`
- [ ] `hound_upgrade`
- [ ] Hound Score algorithm
- [ ] Built-in MCP prompts

### Phase 3 — Star Magnet (3-4 days)
- [ ] Demo GIF / video recording
- [ ] README engineering (banner, badges, examples, comparison table)
- [ ] Remaining utility tools
- [ ] Publish to npm as `hound-mcp`
- [ ] Submit to: awesome-mcp-servers, PulseMCP, mcp.so, mcpservers.org
- [ ] Register on official MCP Registry

### Phase 4 — Growth (ongoing)
- [ ] Streamable HTTP transport (remote server)
- [ ] More lockfile parsers (Cargo.lock, go.sum)
- [ ] Docker image
- [ ] HN launch post
- [ ] Dev.to tutorial
- [ ] Twitter/X thread

---

## GitHub Stars Strategy

### Tagline Options
- "The dependency bloodhound for AI coding agents"
- "Your AI agent's nose for supply chain risk"
- "Sniffs out what npm audit misses"

### README Must-Haves
- [ ] Animated demo GIF as hero (Cursor + hound_audit in action)
- [ ] "Zero config" badge front and center
- [ ] One-liner install: `npx hound-mcp`
- [ ] "Why Hound?" section with the novelty matrix
- [ ] Example prompts that developers can copy-paste
- [ ] Comparison table vs Snyk MCP / npm audit / osv-scanner
- [ ] Supported ecosystems badges (npm, PyPI, Go, etc.)

### Launch Channels
1. **Hacker News** — "Show HN: Hound – AI agent that sniffs out vulnerable dependencies (free, no API key)"
2. **Reddit** — r/programming, r/node, r/python, r/devops, r/opensource
3. **Dev.to** — "Building an AI supply chain security agent with MCP"
4. **Twitter/X** — Demo thread tagging @AnthropicAI, @MCP_protocol
5. **LinkedIn** — Security angle for engineering managers
6. **MCP Directories** — All major ones (5+ directories)

### Comparison Positioning

| | Hound | Snyk MCP | npm audit | osv-scanner |
|---|---|---|---|---|
| Price | Free forever | Freemium | Free | Free |
| API Key needed | No | Yes | No | No |
| MCP native | ✅ | ✅ | ❌ | ❌ |
| Multi-ecosystem | 7 ecosystems | Multiple | npm only | Multiple |
| Reads your lockfile | ✅ | ✅ | ✅ | ✅ |
| Health scoring | ✅ | ❌ | ❌ | ❌ |
| OpenSSF Scorecard | ✅ | ❌ | ❌ | ❌ |
| Typosquat detection | ✅ | ❌ | ❌ | ❌ |
| License compliance | ✅ | Paid tier | ❌ | ❌ |
| Package comparison | ✅ | ❌ | ❌ | ❌ |
| Upgrade pathfinding | ✅ | Paid tier | ❌ | ✅ (CLI) |
| Pre-install safety | ✅ | ❌ | ❌ | ❌ |

---

## Example Prompts for README

```
"Scan my project for security issues"
→ hound_audit reads your lockfile and returns a full risk report

"Should I use axios or got for HTTP requests?"
→ hound_compare gives a side-by-side health comparison

"Is it safe to install left-pad@1.0.0?"
→ hound_preinstall checks vulns, typosquatting, abandonment

"Do I have any GPL dependencies?"
→ hound_license_check walks your full dep tree

"Find a safe version of lodash to upgrade to"
→ hound_upgrade finds the nearest version with no known vulns

"How healthy is the express package?"
→ hound_score computes an A-F health grade

"What vulnerabilities affect jsonwebtoken@8.5.1?"  
→ hound_vulns returns grouped CVEs with fix versions

"Show the dependency tree for next@14.0.0"
→ hound_tree shows every transitive dep with depth
```
