# Ruby Project Audit Example

This example demonstrates how to use Hound to audit a Ruby on Rails project's dependencies for security vulnerabilities.

## Usage

Ask your AI agent:

```
Audit the Gemfile.lock in examples/audit-ruby-project/ for vulnerabilities
```

## What Hound Does

1. Parses the `Gemfile.lock` file to extract all gem dependencies
2. Queries the OSV database for known vulnerabilities in each gem
3. Returns a comprehensive security report with:
   - Total number of vulnerabilities by severity (CRITICAL, HIGH, MODERATE, LOW)
   - Detailed information for each vulnerable gem
   - CVE IDs and fix recommendations

## Expected Output

Hound will scan all gems including Rails framework components (actioncable, actionpack, etc.) and their dependencies (nokogiri, rack, etc.) for known security issues.

The report groups vulnerabilities by severity and provides actionable information to help you prioritize fixes.
