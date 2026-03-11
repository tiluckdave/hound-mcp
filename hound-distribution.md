# 🐕 Hound — Distribution & Architecture

## Where Does Hound Run?

### Primary: Local on User's Machine (stdio)

```
┌─────────────────────────────────────────┐
│  User's Machine                         │
│                                         │
│  ┌──────────┐     ┌──────────────┐      │
│  │ Cursor /  │────→│  Hound MCP   │      │
│  │ Claude /  │←────│  (subprocess)│      │
│  │ VS Code   │     └──────┬───────┘      │
│  └──────────┘             │              │
│                    reads lockfiles       │
│                    from project dir      │
│                           │              │
└───────────────────────────┼──────────────┘
                            │ HTTPS calls
                   ┌────────┴────────┐
                   ↓                 ↓
            deps.dev API        OSV API
            (Google)            (Google)
```

**How it works:**
1. User adds Hound to their MCP client config
2. Client spawns `npx hound-mcp` as a child process
3. Hound communicates via stdin/stdout (stdio transport)
4. Hound reads lockfiles directly from the user's filesystem
5. Hound calls deps.dev + OSV APIs over HTTPS
6. Process dies when the MCP session ends

**Why this is the right default:**
- `hound_audit` needs filesystem access to read lockfiles
- Zero cost for you (no server to maintain)
- No data leaves the user's machine (except API calls to Google)
- No API keys to manage — deps.dev and OSV are free + unauthenticated
- This is how Playwright, GitHub, Sentry, Filesystem MCP servers all work
- Fastest possible latency (no middleman server)

**User config (one-time setup):**
```json
// Claude Desktop / Cursor / VS Code
{
  "mcpServers": {
    "hound": {
      "command": "npx",
      "args": ["-y", "hound-mcp"]
    }
  }
}
```

That's it. No env vars. No API keys. No Docker. Just works.

---

### Secondary: Remote Server (Phase 4, optional)

For teams, web-based MCP clients, or CI/CD pipelines:

```
┌──────────┐        HTTPS        ┌──────────────┐
│ MCP      │ ──────────────────→ │ Hound Remote │
│ Client   │ ←────────────────── │ (your server)│
└──────────┘   Streamable HTTP   └──────┬───────┘
                                        │
                                 ┌──────┴──────┐
                                 ↓             ↓
                           deps.dev API    OSV API
```

**When to add this (not now):**
- When MCP clients that only support remote become popular
- When teams want a shared Hound instance
- When you want to offer a hosted "try it now" experience
- If you build a web dashboard later

**Where to host (when ready):**
- Fly.io (cheapest, easy to deploy, $0 hobby tier)
- Railway (you already know it)
- Cloudflare Workers (edge, fast, generous free tier)

**Key difference:** Remote mode can't read local lockfiles. Users would 
pass lockfile content as a tool parameter instead of a file path. The 
tools should support both: `filePath` for local, `content` for remote.

---

## Complete Distribution Channels

### Tier 1 — Package Registries (where devs install from)

| Channel | What to Do | Priority |
|---------|-----------|----------|
| **npm** | Publish as `hound-mcp`. Users install via `npx hound-mcp` | 🔴 Day 1 |
| **GitHub Releases** | Tag releases, auto-publish via GitHub Actions | 🔴 Day 1 |

### Tier 2 — MCP Directories (where devs discover MCP servers)

| Channel | URL | Submission |
|---------|-----|-----------|
| **Official MCP Registry** | registry.modelcontextprotocol.io | PR to github.com/modelcontextprotocol/registry |
| **awesome-mcp-servers (punkpeye)** | github.com/punkpeye/awesome-mcp-servers | PR — largest list (8,500+) |
| **awesome-mcp-servers (wong2)** | github.com/wong2/awesome-mcp-servers | PR — second largest list |
| **Official servers list** | github.com/modelcontextprotocol/servers | PR — official Anthropic repo |
| **PulseMCP** | pulsemcp.com | Submit via their form |
| **mcp.so** | mcp.so | Submit via GitHub issue |
| **mcpservers.org** | mcpservers.org | Submit via their form |
| **MCP Market** | mcpmarket.com | Submit |
| **Glama** | glama.ai | Auto-indexed from GitHub |
| **Smithery** | smithery.ai | Publish via `@smithery/cli` |
| **MCP Server Finder** | mcpserverfinder.com | Submit |
| **LobeHub MCP** | lobehub.com/mcp | Submit |

### Tier 3 — Content & Community (where devs hear about it)

| Channel | Strategy | When |
|---------|----------|------|
| **Hacker News** | "Show HN: Hound — your AI agent's nose for dependency risks (free, no keys)" | Launch day |
| **Reddit** | r/programming, r/node, r/python, r/devops, r/opensource, r/cursor | Launch day |
| **Dev.to** | Tutorial: "How I built a supply chain security MCP server" | Launch week |
| **Twitter/X** | Demo thread with GIF, tag @AnthropicAI, @cursor_ai | Launch day |
| **LinkedIn** | Security angle post for eng managers | Launch day |
| **YouTube** | 5-min demo video (optional, high effort) | Post-launch |
| **Discord** | MCP Discord, Cursor Discord, Claude Discord | Launch day |

### Tier 4 — IDE Marketplace Integration (bonus reach)

| Channel | What |
|---------|------|
| **Cursor MCP** | Listed in Cursor's MCP server browser |
| **VS Code MCP** | Compatible with VS Code's MCP support |
| **Claude Desktop** | Works natively |
| **Windsurf** | Works natively |
| **Claude Code** | `claude mcp add hound -- npx -y hound-mcp` |
| **Zed** | Works with Zed's MCP support |

---

## Installation Variants (All From npm)

### Simplest (recommended in README)
```bash
# Just works. No install. npx downloads and runs it.
npx hound-mcp
```

### Claude Code (one-liner)
```bash
claude mcp add hound -- npx -y hound-mcp
```

### Claude Desktop / Cursor / VS Code
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

### Smithery (auto-installer)
```bash
npx @smithery/cli install hound-mcp --client cursor
```

### Global Install (power users)
```bash
npm install -g hound-mcp
# Then in MCP config: "command": "hound-mcp"
```

### Docker (for CI/CD or remote)
```bash
docker run -i --rm ghcr.io/tilak-puli/hound-mcp
```

---

## Why You Don't Need a Server

| Concern | Answer |
|---------|--------|
| "Who pays for the API?" | Google does. deps.dev + OSV are free public APIs |
| "What about rate limits?" | No documented limits on either API |
| "What about secrets?" | No secrets needed. Zero auth. |
| "What about user data?" | Lockfile data stays on their machine. Only package names go to Google's APIs |
| "What about uptime?" | Google's SLO for OSV is 99.9%. deps.dev is production-grade |
| "What if I want analytics?" | npm download counts + GitHub stars are your metrics |
| "Can enterprises use this?" | Yes — local mode means no data leaves their network except to Google |

---

## Revenue Potential (Future, Optional)

Even though Hound is free and open source, here's how this could evolve:

1. **Hound Pro (remote hosted)** — Teams pay for a shared hosted instance with dashboard, CI/CD integration, Slack alerts. $29/team/month.

2. **Hound GitHub Action** — Free action that runs `hound_audit` on every PR. Upsell to Pro for historical tracking.

3. **Hound Badge** — "Dependencies audited by Hound 🐕" badge for READMEs (like Snyk badge). Free, drives awareness.

4. **Consulting** — "We'll set up supply chain security for your org using Hound + MCP." Leverage your Workato integration expertise.

None of this is needed for launch. Ship the OSS tool, get stars, build credibility. Monetize later if you want to.

---

## Launch Checklist (in order)

```
Week 1: Build
 □ Phase 1 MVP (4 core tools working)
 □ Phase 2 novel layer (audit, compare, preinstall)
 □ Test with Cursor + Claude Desktop locally

Week 2: Polish & Ship  
 □ README engineering (GIF, badges, examples)
 □ Publish to npm as hound-mcp
 □ Tag GitHub release v0.1.0
 □ Submit PRs to all MCP directories (12 directories)
 □ Publish via Smithery CLI

Week 2-3: Launch
 □ Hacker News "Show HN" post
 □ Reddit posts (5 subreddits)
 □ Twitter/X demo thread
 □ Dev.to tutorial article
 □ LinkedIn post
 □ Discord communities

Week 4+: Iterate
 □ Respond to issues / feature requests
 □ Add more lockfile parsers based on demand
 □ Consider remote mode if requested
 □ Blog about interesting vulns Hound catches
```
