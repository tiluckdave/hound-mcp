# Tool Reference

Full reference for all 12 Hound MCP tools with syntax and example output.

---

## `hound_audit` ⭐

Scan an entire lockfile for vulnerabilities. Parses `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `requirements.txt`, `Cargo.lock`, or `go.sum` and batch-queries OSV across all dependencies.

```text
hound_audit(lockfile_name: "package-lock.json", lockfile_content: "<contents>")
```

### Example: hound_audit

```text
🐕 Hound Audit — package-lock.json
══════════════════════════════════════════════════
Scanned 142 packages

🔴 CRITICAL — 2 packages
──────────────────────────────
  lodash@4.17.20
    GHSA-35jh-r3h4-6jhm · Prototype pollution via zipObjectDeep
    Fix: upgrade to 4.17.21

  axios@0.21.1
    GHSA-42xw-2xvc-qx8m · Server-side request forgery
    Fix: upgrade to 0.21.2

🟠 HIGH — 1 package
──────────────────────────────
  minimist@1.2.5
    GHSA-xvch-5gv4-984h · Prototype pollution
    Fix: upgrade to 1.2.6

✅ 139 packages clean

Source: OSV.dev
```

---

## `hound_vulns`

List all known vulnerabilities for a specific package version, grouped by severity with fix versions.

```text
hound_vulns(name: "lodash", version: "4.17.20", ecosystem: "npm")
```

### Example: hound_vulns

```text
🔍 Vulnerabilities in lodash@4.17.20 (npm)
──────────────────────────────────────────────────
Found 3 vulnerabilities

🔴 CRITICAL (1)
──────────────────────────────
  GHSA-35jh-r3h4-6jhm
  Prototype Pollution in lodash
  Fix: upgrade to 4.17.21
  Also known as: CVE-2021-23337
  Published: 2021-02-15

🟠 HIGH (1)
──────────────────────────────
  GHSA-4xc9-xhrj-v574
  Command Injection in lodash
  Fix: upgrade to 4.17.21
  Also known as: CVE-2021-23362
  Published: 2021-03-05

🟡 MODERATE (1)
──────────────────────────────
  GHSA-p6mc-m468-83gw
  Prototype pollution in lodash
  Fix: upgrade to 4.17.21
  Also known as: CVE-2020-28500
  Published: 2021-02-15

Source: https://osv.dev
```

---

## `hound_inspect`

Comprehensive package profile — license, vulnerabilities, OpenSSF Scorecard, GitHub stars, and dep count in one call.

```text
hound_inspect(name: "express", version: "4.18.2", ecosystem: "npm")
```

### Example: hound_inspect

```text
📦 express@4.18.2 (npm)
══════════════════════════════════════════════════

📅 Published: 2022-10-08 (821 days ago)
📄 License: MIT
🛡️  Vulnerabilities: None known

📊 Project Health
──────────────────────────────
⭐ Stars: 64,128
🍴 Forks: 13,402
🐛 Open issues: 172
🏆 OpenSSF Scorecard: 6.8/10 (B)
   Lowest checks: Binary-Artifacts (0/10), Branch-Protection (3/10), Fuzzing (0/10)

🌐 Homepage: https://expressjs.com
💻 Source: https://github.com/expressjs/express

🔗 deps.dev: https://deps.dev/npm/packages/express/versions/4.18.2
```

---

## `hound_score`

Compute a 0–100 Hound Score combining vulnerability severity (40 pts), OpenSSF Scorecard (25 pts), release recency (20 pts), and license risk (15 pts). Returns a letter grade A–F.

```text
hound_score(name: "express", version: "4.18.2", ecosystem: "npm")
```

### Example: hound_score

```text
🟡 Hound Score: 80/100 — Grade B
   express@4.18.2 (npm)
══════════════════════════════════════════════════

Score Breakdown
──────────────────────────────
  Security (vulns)     40/40
  OpenSSF Scorecard    17/25
  Release recency      10/20
  License              15/15
                      ──────
  Total                80/100

✅ No known vulnerabilities
🏆 OpenSSF Scorecard: 6.8/10
📅 Published 821 days ago
✅ License: MIT

Source: OSV.dev + deps.dev
```

---

## `hound_upgrade`

Find the minimum version upgrade that resolves all known vulnerabilities. Checks every published version and returns the nearest safe one.

```text
hound_upgrade(name: "lodash", version: "4.17.20", ecosystem: "npm")
```

### Example: hound_upgrade

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

---

## `hound_compare`

Side-by-side comparison of two packages across vulnerabilities, OpenSSF Scorecard, GitHub stars, release recency, and license. Returns a recommendation.

```text
hound_compare(package_a: "express", package_b: "fastify", ecosystem: "npm")
```

### Example: hound_compare

```text
⚖️  Package Comparison (npm)
══════════════════════════════════════════════════
                        express         fastify
──────────────────────────────────────────────────
Version                 4.18.2          4.26.2
Vulnerabilities         0               0
OpenSSF Scorecard       6.8/10          7.2/10
Stars                   64,128          31,204
Days since release      821             45
License                 MIT             MIT

🏆 Recommendation: fastify
   More recently maintained and slightly higher security score.

Source: OSV.dev + deps.dev
```

---

## `hound_preinstall`

Safety check before installing a package. Checks vulnerabilities, typosquatting risk, abandonment, and license. Returns a GO / CAUTION / NO-GO verdict.

```text
hound_preinstall(name: "lodash", version: "4.17.20", ecosystem: "npm")
```

### Example: hound_preinstall

```text
🚫 Pre-install check: lodash@4.17.20 (npm)
════════════════════════════════════════════════════════════
Verdict: NO-GO

🚫 Blockers
──────────────────────────────
  • 2 CRITICAL/HIGH vulnerabilities known for this version

⚠️  Warnings
──────────────────────────────
  • Package version is 3 year(s) old — may be abandoned

💡 Run hound_vulns for full vulnerability details.
💡 Run hound_upgrade to find a safe version.

Source: OSV.dev + deps.dev
```

---

## `hound_tree`

Full resolved dependency tree including all transitive dependencies, with depth control.

```text
hound_tree(name: "next", version: "14.2.0", ecosystem: "npm", maxDepth: 3)
```

### Example: hound_tree

```text
🌳 Dependency tree: next@14.2.0 (npm) — depth 3
══════════════════════════════════════════════════

next@14.2.0
├── react@18.2.0
│   └── loose-envify@1.4.0
│       └── js-tokens@4.0.0
├── react-dom@18.2.0
│   ├── react@18.2.0
│   └── scheduler@0.23.0
├── @next/env@14.2.0
├── postcss@8.4.31
│   ├── lilconfig@3.0.0
│   └── yaml@2.3.4
└── styled-jsx@5.1.1
    └── client-only@0.0.1

Total: 127 dependencies (direct: 14, transitive: 113)

Source: deps.dev
```

---

## `hound_advisories`

Full advisory details by ID — works with GHSA, CVE, and OSV IDs.

```text
hound_advisories(id: "GHSA-35jh-r3h4-6jhm")
hound_advisories(id: "CVE-2024-29041")
```

### Example: hound_advisories

```text
📋 Advisory: GHSA-35jh-r3h4-6jhm
══════════════════════════════════════════════════
Command Injection in lodash
Severity: CRITICAL

Affected: lodash < 4.17.21 (npm)
Fix:      upgrade to 4.17.21

Also known as: CVE-2021-23337
Published: 2021-02-15
Modified:  2021-03-05

Summary:
Lodash versions prior to 4.17.21 are vulnerable to Command Injection
via the template function due to improper input sanitization.

Source: https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm
```

---

## `hound_typosquat`

Generates likely typo variants of a package name and checks which ones exist in the registry — surfaces potential typosquatting attacks.

```text
hound_typosquat(name: "lodash", ecosystem: "npm")
```

### Example: hound_typosquat

```text
🔎 Typosquat check: lodash (npm)
══════════════════════════════════════════════════
Generated 24 variants — checking registry...

⚠️  2 suspicious package(s) found in npm:

  lodahs    — exists in registry (transposition: a↔h)
  lodash-js — exists in registry (suffix addition)

✅ 22 variants do not exist in the registry

💡 If you meant to install lodash, double-check your package name.

Source: deps.dev
```

---

## `hound_license_check`

Scan a lockfile for license compliance. Resolves licenses for all dependencies and flags packages that violate the chosen policy.

```text
hound_license_check(lockfile_name: "package-lock.json", lockfile_content: "<contents>", policy: "permissive")
```

### Policies

| Policy | Allows |
| ------ | ------ |
| `permissive` | MIT, Apache-2.0, BSD only |
| `copyleft` | Allows GPL but not AGPL |
| `none` | Report only — no violations flagged |

### Example: hound_license_check

```text
📄 License Audit — package-lock.json (policy: permissive)
══════════════════════════════════════════════════
Scanned 142 packages

❌ Policy violations — 1 package
──────────────────────────────
  node-forge@1.3.1    GPL-2.0   (copyleft — violates permissive policy)

✅ 141 packages comply with permissive policy

License breakdown:
  MIT            118
  Apache-2.0      14
  BSD-3-Clause     8
  ISC              1
  GPL-2.0          1

Source: deps.dev
```

---

## `hound_popular`

Scan a list of popular (or user-specified) packages for known vulnerabilities.

```text
hound_popular(ecosystem: "npm")
hound_popular(ecosystem: "pypi", packages: ["requests", "flask", "django"])
```

### Example: hound_popular

```text
🌐 Popular package scan — npm
══════════════════════════════════════════════════
Scanned 10 popular packages

⚠️  1 package with known vulnerabilities:

  express@4.18.1    🟡 1 moderate
    GHSA-rv95-896h-c2vc · Open redirect in res.location()
    Fix: upgrade to 4.18.2

✅ 9 packages clean: react, lodash, axios, next, typescript,
   prettier, eslint, webpack, babel

Source: OSV.dev + deps.dev
```
