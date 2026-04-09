---
name: audit-route
description: Run a security audit on an API route or Server Action file using the Security Auditor agent. Checks for missing auth, permission gaps, input validation, and data exposure.
argument-hint: <file path>
---

# Audit Route

Run a security audit on a specific file using the Security Auditor agent.

## Instructions

1. Get the file path from arguments: $ARGUMENTS

2. Read the file content using the Read tool

3. Determine the file type:
   - If path contains `app/api/` → `api_route`
   - If path contains `app/actions/` → `server_action`
   - If path contains `middleware` → `middleware`
   - If path contains `lib/` → `lib`
   - Otherwise → `other`

4. Run the audit by creating `__temp_audit.ts`, running it with `npx tsx __temp_audit.ts`, then deleting it:

```typescript
import { readFileSync } from "fs"
import { auditSecurity } from "./agents"

const code = readFileSync("$ARGUMENTS", "utf-8")

const audit = await auditSecurity({
  code,
  filename: "$ARGUMENTS",
  fileType: "api_route", // update based on detected type
})

console.log("=== SECURITY AUDIT ===")
console.log("File:", "$ARGUMENTS")
console.log("Result:", audit.passed ? "✓ PASSED" : "✗ FAILED")
console.log("Risk level:", audit.riskLevel.toUpperCase())
console.log("Summary:", audit.summary)
console.log(`\nIssues: ${audit.criticalCount} critical, ${audit.highCount} high, ${audit.mediumCount} medium, ${audit.lowCount} low`)

if (audit.issues.length > 0) {
  console.log("\n=== ISSUES ===")
  audit.issues.forEach((issue, i) => {
    console.log(`\n[${i + 1}] [${issue.severity.toUpperCase()}] ${issue.title}`)
    console.log("  Category:", issue.category)
    if (issue.line) console.log("  Line:", issue.line)
    console.log("  Problem:", issue.description)
    console.log("  Fix:", issue.fix)
    if (issue.codeExample) console.log("  Example:\n", issue.codeExample)
  })
}

if (audit.noIssuesFound.length > 0) {
  console.log("\n=== CLEAN CHECKS ===")
  audit.noIssuesFound.forEach(c => console.log(" ✓", c))
}
```

5. Present the audit results clearly.

6. If `audit.passed === false`:
   - List each critical and high issue with the exact fix
   - Ask: "Want me to apply these fixes now?"

7. If `audit.passed === true`:
   - Confirm the file is safe to deploy
   - Mention any medium/low suggestions briefly

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Mandatory for all files in `app/api/` and `app/actions/` before deploying
- Clean up `__temp_audit.ts` after running
