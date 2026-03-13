# Prompt Reference

Hound ships with 3 built-in MCP prompts you can invoke directly from your AI client — no tool calls needed.

---

## `security_audit`

Full project security audit. Scans for vulnerabilities, license issues, and typosquat risks across your entire dependency tree.

### Usage

```text
/security_audit ecosystem="npm"
```

### Parameters

| Parameter | Required | Description |
| --------- | -------- | ----------- |
| `ecosystem` | Yes | Package ecosystem (`npm`, `pypi`, `go`, `maven`, `cargo`, `nuget`, `rubygems`) |

### What it does

1. Reads your lockfile
2. Runs `hound_audit` to surface all vulnerabilities grouped by severity
3. Runs `hound_license_check` with your policy
4. Flags any typosquat risks in your dependency names
5. Returns a prioritized list of actions

### Example prompt

> "Run a full security audit on this project using the security_audit prompt with ecosystem npm"

---

## `package_evaluation`

Go/no-go recommendation before adding a new dependency to your project.

### Usage

```text
/package_evaluation package="axios" version="1.6.0" ecosystem="npm"
```

### Parameters

| Parameter | Required | Description |
| --------- | -------- | ----------- |
| `package` | Yes | Package name to evaluate |
| `version` | No | Specific version (defaults to latest) |
| `ecosystem` | Yes | Package ecosystem |

### What it does

1. Runs `hound_preinstall` for a GO / CAUTION / NO-GO verdict
2. Runs `hound_inspect` for a full package profile (license, stars, scorecard)
3. Runs `hound_score` for the 0–100 Hound Score
4. Returns a clear recommendation with reasoning

### Example prompt

> "Before we add axios to this project, evaluate it using the package_evaluation prompt"

---

## `pre_release_check`

Pre-ship dependency scan. Flags any release blockers in your current dependency tree before you cut a release.

### Usage

```text
/pre_release_check version="1.2.0"
```

### Parameters

| Parameter | Required | Description |
| --------- | -------- | ----------- |
| `version` | No | The release version you're cutting (for context in the report) |

### What it does

1. Reads your lockfile
2. Runs `hound_audit` to check for any new or unresolved vulnerabilities
3. Runs `hound_license_check` to catch any license regressions
4. Returns a pass/fail verdict with a list of blockers that must be resolved before shipping

### Example prompt

> "We're about to release v2.0.0 — run the pre_release_check prompt to make sure our dependencies are clean"
