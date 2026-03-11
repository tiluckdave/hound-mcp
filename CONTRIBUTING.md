# Contributing to Hound

First off — thank you. Hound is free, open-source, and community-driven. Every contribution matters.

## The One Rule

**Hound must stay zero-config and free forever.** Don't add features that require API keys, accounts, or paid services. The zero-auth constraint is a feature, not a limitation.

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Setup

```bash
git clone https://github.com/tiluckdave/hound-mcp.git
cd hound-mcp
pnpm install
pnpm build
```

### Run in dev mode

```bash
pnpm dev
```

### Run tests

```bash
pnpm test
pnpm test:watch   # watch mode
```

### Lint and format

```bash
pnpm lint         # check
pnpm lint:fix     # auto-fix
pnpm typecheck    # TypeScript check
```

---

## Project Structure

```sh
src/
├── index.ts          # Entry point (stdio transport)
├── server.ts         # MCP server + tool registration
├── tools/            # One file per MCP tool
├── parsers/          # One file per lockfile format
├── api/              # External API clients (deps.dev, OSV)
├── scoring/          # Risk scoring algorithm
└── types/            # Shared TypeScript types
tests/
└── ...               # Mirror src/ structure
```

## Adding a New Tool

1. Create `src/tools/your-tool.ts`
2. Export a `register` function that takes the MCP server instance
3. Import and call it in `src/server.ts`
4. Add a test in `tests/tools/your-tool.test.ts`

```typescript
// src/tools/your-tool.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function register(server: McpServer): void {
  server.tool(
    "hound_your_tool",
    "Description of what this tool does",
    {
      packageName: z.string().describe("The package name"),
    },
    async ({ packageName }) => {
      // implementation
      return {
        content: [{ type: "text", text: `Result for ${packageName}` }],
      };
    },
  );
}
```

## Adding a New Lockfile Parser

1. Create `src/parsers/your-format.ts`
2. Export a `parse(content: string): ParsedDependency[]` function
3. Add tests in `tests/parsers/your-format.test.ts`
4. Register it in `src/tools/audit.ts`

---

## Code Style

- TypeScript strict mode — no `any`, ever
- All tool outputs are **human-readable formatted text**, not JSON blobs
- All API calls go through `src/api/` clients — never call `fetch` directly in tools
- Use Zod for all input validation
- Error messages must be user-friendly — no raw stack traces to the AI agent

---

## Submitting a PR

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run `pnpm check` (typecheck + lint + tests must pass)
5. Open a PR with a clear description of what and why

### PR checklist

- [ ] `pnpm check` passes
- [ ] New functionality has tests
- [ ] Tool output is human-readable text
- [ ] No new dependencies that require auth or accounts
- [ ] CLAUDE.md updated if you changed architecture

---

## Reporting Issues

Open an issue at [github.com/tiluckdave/hound-mcp/issues](https://github.com/tiluckdave/hound-mcp/issues).

Include:

- What you did
- What you expected
- What actually happened
- Your Node.js version and OS

---

## License

By contributing, you agree your contributions are licensed under the MIT License.
