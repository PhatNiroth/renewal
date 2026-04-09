/**
 * Security Auditor Agent
 *
 * Focused security review for Next.js API routes and Server Actions.
 * Checks specifically for auth gaps, permission bypass, input validation,
 * data exposure, and injection risks.
 *
 * Separate from the Code Review Agent which checks general quality.
 * This agent thinks like an attacker — what could go wrong?
 *
 * Usage:
 *   const audit = await auditSecurity({ code, filename, fileType })
 *   // Block deployment if audit.passed === false
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface SecurityAuditInput {
  code: string
  filename: string          // e.g. "app/api/admin/users/route.ts"
  fileType: "api_route" | "server_action" | "middleware" | "lib" | "component" | "other"
  context?: string          // optional description of what this code does
}

const SecurityIssueSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]).describe(
    "critical = exploitable now, high = likely exploitable, medium = potential risk, low = best practice"
  ),
  category: z.enum([
    "missing_auth",           // no session check
    "missing_permission",     // auth but no role/permission check
    "input_validation",       // user input used without validation
    "data_exposure",          // sensitive data returned in response
    "injection_risk",         // SQL/command injection possibility
    "csrf",                   // cross-site request forgery
    "rate_limiting",          // no rate limiting on sensitive endpoint
    "secret_exposure",        // API keys or secrets in code
    "insecure_direct_object", // accessing resource without ownership check
    "other",
  ]),
  line: z.number().nullable().describe("Approximate line number where the issue exists"),
  title: z.string().describe("Short title, e.g. 'Admin endpoint missing role check'"),
  description: z.string().describe("What the vulnerability is and how it could be exploited"),
  fix: z.string().describe("Specific code fix to apply"),
  codeExample: z.string().nullable().describe("Fixed code snippet example, or null if not applicable"),
})

const SecurityAuditSchema = z.object({
  passed: z.boolean().describe("True if no critical or high severity issues found — safe to deploy"),
  riskLevel: z.enum(["safe", "low", "medium", "high", "critical"]).describe("Overall security risk level"),
  summary: z.string().describe("2-3 sentence security assessment"),
  issues: z.array(SecurityIssueSchema).describe("All security issues found, ordered by severity"),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  checkedFor: z.array(z.string()).describe("Security checks that were performed"),
  noIssuesFound: z.array(z.string()).describe("Security areas checked and found clean"),
})

export type SecurityIssue = z.infer<typeof SecurityIssueSchema>
export type SecurityAudit = z.infer<typeof SecurityAuditSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function auditSecurity(input: SecurityAuditInput): Promise<SecurityAudit> {
  const { code, filename, fileType, context } = input

  const prompt = `
You are a security engineer performing a focused security audit on code for an internal
subscription management system handling real company financial data.

File: ${filename}
Type: ${fileType}
${context ? `Context: ${context}` : ""}

This app uses:
- NextAuth v5 — auth() returns the session, user has isAdmin boolean and permissions object
- Prisma 5 — db.model.method() for DB queries
- Next.js 16.2.2 App Router — API routes and Server Actions

Security checklist for this project:

FOR API ROUTES AND SERVER ACTIONS:
1. Auth check: does code call auth() and verify session exists?
2. Admin check: if admin-only, does it check user.isAdmin === true?
3. Permission check: if permission-gated, does it check user.permissions[MODULE][action]?
4. Ownership check: if accessing a resource, does it verify it belongs to the current user?
5. Input validation: is all user input validated before use in DB queries?
6. Raw queries: are any Prisma.$queryRaw() calls used? (injection risk)
7. Response data: does any response leak password hashes, tokens, or internal IDs?
8. Error messages: do error responses expose internal system details?

FOR COMPONENTS:
9. XSS: is user-controlled data rendered without sanitization using dangerouslySetInnerHTML?
10. Sensitive data in client: are secrets or sensitive data passed to "use client" components?

FOR MIDDLEWARE:
11. Edge-safe: no Prisma or bcrypt imports (not Edge Runtime compatible)
12. All protected routes covered by auth check

Think like an attacker. For each issue, explain exactly how it could be exploited.
Be specific — don't flag theoretical issues, only real risks based on the actual code.

\`\`\`typescript
${code}
\`\`\`
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(SecurityAuditSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Security audit failed: no structured output returned")
  }

  const audit = response.parsed_output

  // Sort issues: critical first
  const order = { critical: 0, high: 1, medium: 2, low: 3 }
  audit.issues.sort((a, b) => order[a.severity] - order[b.severity])

  return audit
}
