# Example: Pre-install Safety Check

Check a package before your AI agent installs it, and compare alternatives.

## Scenario

Your agent suggests adding `lodash@4.17.20` to your project. Before installing, run a safety check.

## Step 1 — Pre-install check

Ask your AI agent:

```text
Run hound_preinstall for lodash version 4.17.20 on npm.
```

### Expected output

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

## Step 2 — Compare with an alternative

```text
Compare lodash and radash on npm using hound_compare.
```

### Comparison output

```text
⚖️  Package Comparison (npm)
══════════════════════════════════════════════════
                        lodash          radash
──────────────────────────────────────────────────
Version                 4.17.21         12.1.0
Vulnerabilities         0               0
OpenSSF Scorecard       6.1/10          4.2/10
Stars                   59,204          3,847
Days since release      1,240           180
License                 MIT             MIT

🏆 Recommendation: lodash
   More established with a higher security score, though less recently maintained.

Source: OSV.dev + deps.dev
```
