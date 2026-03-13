# Example: License Compliance Scan

Ensure no copyleft packages sneak into a commercial project.

## Scenario

You're building a commercial product and need to ensure all dependencies use permissive licenses (MIT, Apache-2.0, BSD). A GPL package would require you to open-source your code.

## Step 1 — Run a license audit

Ask your AI agent:

```text
Read examples/license-compliance/package-lock.json and run hound_license_check on it with policy "permissive".
```

### Expected output

```text
📄 License Audit — package-lock.json (policy: permissive)
══════════════════════════════════════════════════
Scanned 4 packages

❌ Policy violations — 1 package
──────────────────────────────
  node-forge@1.3.1    GPL-2.0   (copyleft — violates permissive policy)

✅ 3 packages comply with permissive policy

License breakdown:
  MIT       3
  GPL-2.0   1

Source: deps.dev
```

## Step 2 — Inspect the violating package

```text
Run hound_inspect for node-forge version 1.3.1 on npm.
```

Use the output to decide whether to replace `node-forge` with a permissively-licensed alternative (e.g., `@peculiar/webcrypto`).
