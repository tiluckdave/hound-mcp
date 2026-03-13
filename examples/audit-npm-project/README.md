# Example: Audit an npm Project

Scan a `package-lock.json` for vulnerabilities and find safe upgrade paths.

## Setup

This example uses a minimal lockfile with two known-vulnerable packages:

- `lodash@4.17.20` — 3 known CVEs (CRITICAL, HIGH, MODERATE)
- `axios@0.21.1` — 1 known CVE (HIGH, SSRF)

## Step 1 — Audit the lockfile

Ask your AI agent:

```text
Read the file examples/audit-npm-project/package-lock.json and run hound_audit on it.
```

### Expected output

```text
🐕 Hound Audit — package-lock.json
══════════════════════════════════════════════════
Scanned 3 packages

🔴 CRITICAL — 1 package
──────────────────────────────
  lodash@4.17.20
    GHSA-35jh-r3h4-6jhm · Prototype pollution via zipObjectDeep
    Fix: upgrade to 4.17.21

🟠 HIGH — 2 packages
──────────────────────────────
  lodash@4.17.20
    GHSA-4xc9-xhrj-v574 · Command Injection in lodash
    Fix: upgrade to 4.17.21

  axios@0.21.1
    GHSA-42xw-2xvc-qx8m · Server-side request forgery
    Fix: upgrade to 0.21.2

✅ 1 package clean: express@4.18.2

Source: OSV.dev
```

## Step 2 — Find safe upgrades

```text
Run hound_upgrade for lodash version 4.17.20 on npm.
```

### Upgrade output

```text
🔍 Safe upgrade finder: lodash (npm)
══════════════════════════════════════════════════
Current version: 4.17.20
Candidates checked: 1 of 1 newer versions

✅ Safe upgrade available

  Minimum safe version: 4.17.21
  Latest safe version:  4.17.21

💡 Recommended: upgrade to 4.17.21

Source: OSV.dev + deps.dev
```
