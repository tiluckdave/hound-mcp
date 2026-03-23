# Hound MCP — Contributor Guide

This file is for contributors making bug fixes and enhancements. It describes how the code is structured, how to work with it, and the conventions to follow.

---

## Tech Stack

| Concern | Tool |
| --- | --- |
| Language | TypeScript (strict mode) |
| Runtime | Node.js 18+ |
| MCP SDK | `@modelcontextprotocol/sdk` |
| Validation | Zod (import from `zod/v4`) |
| Build | tsup |
| Testing | Vitest |
| Linting | ESLint + typescript-eslint |
| Formatting | Prettier |
| Package manager | pnpm |

---

## Project Structure

```sh
hound-mcp/
├── src/
│   ├── index.ts              # Entry point — starts stdio transport
│   ├── server.ts             # Creates McpServer, registers all tools & prompts
│   ├── tools/
│   │   ├── vulns.ts          # hound_vulns
│   │   ├── inspect.ts        # hound_inspect
│   │   ├── tree.ts           # hound_tree
│   │   ├── typosquat.ts      # hound_typosquat
│   │   ├── advisories.ts     # hound_advisories
│   │   └── popular.ts        # hound_popular
│   ├── prompts/
│   │   └── index.ts          # Registers the 3 built-in MCP prompts
│   ├── api/
│   │   ├── depsdev.ts        # deps.dev API client (package metadata, dep trees, scorecard)
│   │   └── osv.ts            # OSV API client (vulnerabilities, batch queries)
│   ├── utils/
│   │   └── getDefaultVersion.ts  # Shared helper for picking default package version
│   └── types/
│       └── index.ts          # Shared types (Ecosystem, etc.)
├── tests/
│   ├── api/                  # Unit tests for API clients
│   ├── utils/                # Unit tests for shared utilities
│   ├── parsers/              # Unit tests for lockfile parsers
│   └── tools/                # Unit tests for tools
├── eslint.config.js
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## Data Sources

Both APIs are free and unauthenticated — never add anything that requires an API key.

- **deps.dev** (`https://api.deps.dev/v3/`) — package versions, licenses, dependency graphs, OpenSSF Scorecard
- **OSV** (`https://api.osv.dev/v1/`) — vulnerability records, severity, fix versions; supports batch querying

---

## Common Commands

```bash
pnpm build        # compile via tsup → dist/
pnpm dev          # watch mode
pnpm test         # run vitest
pnpm lint         # eslint src/ tests/
pnpm lint:fix     # eslint --fix
pnpm format       # prettier --write
pnpm typecheck    # tsc --noEmit
pnpm check        # typecheck + lint + test (what CI runs)
```

---

## Coding Conventions

### Imports

- Always import Zod as `import { z } from "zod/v4"` (not `"zod"`) — required for correct type resolution with the MCP SDK
- Always use `import type` for type-only imports

### Tools

- Each tool lives in its own file under `src/tools/`
- Export a `register(server: McpServer)` function that returns `server.registerTool(...)`
- Use `server.registerTool()` — `server.tool()` is deprecated and will fail lint
- Input schemas use Zod via `inputSchema: { ... }` in the config object
- Tool outputs are formatted text strings — never return raw JSON to the agent

### API calls

- All HTTP calls go through `src/api/depsdev.ts` or `src/api/osv.ts` — never call `fetch` directly in tools
- Use OSV's batch endpoint (`queryVulnsBatch`) when scanning multiple packages

### Errors

- Return user-friendly error messages, never raw stack traces
- Use `try/catch` in tools for API calls and return a `content: [{ type: "text", text: "..." }]` error response

### TypeScript

- Strict mode is on — no `any`, no implicit types
- `noUncheckedIndexedAccess` is on — use optional chaining or explicit guards when indexing arrays

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
      // call src/api/* only — no direct fetch
      return {
        content: [{ type: "text", text: `Result for ${name}` }],
      };
    },
  );
}
```

1. Import and call `register(server)` in `src/server.ts`
1. Add tests in `tests/tools/your-tool.test.ts`

---

## Adding a New API Client

If a new free, unauthenticated data source is needed:

1. Create `src/api/your-source.ts`
2. Export typed functions — no raw `fetch` calls in tools
3. Add unit tests in `tests/api/your-source.test.ts`
4. Export custom error class (e.g. `YourSourceError extends Error`) for consistent error handling

---

## Testing

Tests use Vitest with `vi.mock()` to mock API modules — no real network calls in tests.

Coverage thresholds are enforced in `vitest.config.ts` — `pnpm test:coverage` will fail if coverage drops below the configured minimums.

Pattern for tool tests:

```typescript
vi.mock("../../src/api/osv.js");

describe("hound_your_tool", () => {
  let tool: ReturnType<typeof register>;

  beforeEach(() => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    tool = register(server);
  });

  it("does the thing", async () => {
    vi.mocked(osv.queryVulns).mockResolvedValue([]);
    const result = await (tool.handler as (args: Record<string, unknown>) => Promise<unknown>)({ name: "express", version: "4.19.2", ecosystem: "npm" });
    expect((result as { content: { text: string }[] }).content[0]?.text).toContain("expected text");
  });
});
```

---

## Workflow

**All changes must go through a PR** — never push directly to `main`. Create a branch, make changes, open a PR.

---

## Security Notes

- API responses from deps.dev and OSV are external data — the TypeScript types are used for shape, but treat values as untrusted
- The typosquat tool surfaces similar package names — never suggest auto-installing anything
- Never store or log user inputs
