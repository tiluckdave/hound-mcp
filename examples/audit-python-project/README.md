# Example: Audit a Python Project

Scan a `requirements.txt` for vulnerabilities.

## Setup

This example uses a minimal requirements file with a known-vulnerable package:

- `Pillow==9.0.0` — multiple HIGH CVEs (arbitrary code execution via image parsing)

## Step 1 — Audit the lockfile

Ask your AI agent:

```text
Read the file examples/audit-python-project/requirements.txt and run hound_audit on it.
```

### Expected output

```text
🐕 Hound Audit — requirements.txt
══════════════════════════════════════════════════
Scanned 3 packages

🟠 HIGH — 1 package
──────────────────────────────
  Pillow@9.0.0
    GHSA-4fx9-vc88-q2xc · Uncontrolled resource consumption in PIL
    Fix: upgrade to 9.0.1

✅ 2 packages clean: requests@2.28.0, flask@2.2.2

Source: OSV.dev
```

## Step 2 — Get full vulnerability details

```text
Run hound_vulns for Pillow version 9.0.0 on pypi.
```
