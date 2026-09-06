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
pnpm format       # prettier
pnpm typecheck    # TypeScript check
pnpm check        # run everything (typecheck + lint + test)
```

---

## Project Structure

```sh
src/
├── index.ts          # Entry point (stdio transport)
├── server.ts         # MCP server + tool & prompt registration
├── tools/            # One file per MCP tool
├── prompts/          # Built-in MCP prompts
├── api/              # External API clients (deps.dev, OSV)
└── types/            # Shared TypeScript types
tests/
├── api/              # Unit tests for API clients
└── tools/            # Unit tests for tools
```

---

## Adding a New Tool

1. Create `src/tools/your-tool.ts`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function register(server: McpServer) {
  return server.registerTool(
    "hound_your_tool",
    {
      description: "What this tool does in one sentence.",
      inputSchema: {
        name: z.string().describe("The package name"),
      },
    },
    async ({ name }) => {
      return {
        content: [{ type: "text", text: `Result for ${name}` }],
      };
    },
  );
}
```

2. Import and call `register(server)` in `src/server.ts`
3. Add tests in `tests/tools/your-tool.test.ts`

---

## Adding a Lockfile Parser

Nearly every parser PR misses a step — tests, tool descriptions, or the ecosystem enum — which costs a review round-trip. Work through this checklist:

1. **Write the parser** — add a `parseXxx()` function in `src/parsers/index.ts`.
2. **Register the format** — add its parser and metadata to `SUPPORTED_LOCKFILES` in `src/parsers/index.ts`. Tool descriptions and unsupported-format errors are generated from this registry.
3. **Register the ecosystem** — if the format introduces a new package ecosystem, add it to `ECOSYSTEM_VALUES` in `src/constants/ecosystems.ts`.
4. **Add tests** — add a `describe()` block for the format in `tests/parsers/index.test.ts` covering:
   - the happy path, with a realistic (trimmed) lockfile fixture parsing into the expected deps
   - invalid or malformed input returning `[]`
5. **Optional: add an example** — add a project under `examples/` that demonstrates `hound_audit` or `hound_license_check` against the new format, and link it from `examples/README.md`.

Run `pnpm check` before opening the PR — it catches most of the above automatically (typecheck + lint + tests).

---

## Code Style

- TypeScript strict mode — no `any`, ever
- All tool outputs are **human-readable formatted text**, not JSON blobs
- All API calls go through `src/api/` clients — never call `fetch` directly in tools
- Import Zod as `import { z } from "zod/v4"` (not `"zod"`)
- Use `server.registerTool()` — `server.tool()` is deprecated
- Error messages must be user-friendly — no raw stack traces

---

## Submitting a PR

1. Fork the repo
1. Create a branch: `git checkout -b feat/your-feature`
1. Make your changes
1. Run `pnpm check` — typecheck + lint + tests must all pass
1. Open a PR with a clear description of what and why

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
