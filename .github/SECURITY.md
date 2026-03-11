# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |

We support the latest published version only. Always upgrade to the latest release before reporting a vulnerability.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/tiluckdave/hound-mcp/security/advisories/new).

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

We will acknowledge receipt within **48 hours** and aim to provide a fix within **7 days** for critical issues.

## Scope

Hound is a local stdio MCP server. It:

- Reads lockfiles from the user's filesystem
- Makes outbound HTTPS requests to `api.deps.dev` and `api.osv.dev`
- Does **not** store, transmit, or log user data beyond those API calls
- Does **not** execute any code from lockfiles or package metadata

Security issues in scope:

- Path traversal when reading lockfiles
- Injection via malicious package names/versions in tool inputs
- Dependency vulnerabilities in Hound itself (please report via advisories above)

## Keeping Hound Secure

Hound itself is a security tool — we hold it to a high standard. We run `pnpm audit` on every release and address high/critical findings before publishing.
