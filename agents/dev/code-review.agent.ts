/**
 * Code Review Agent
 *
 * Reviews TypeScript/JavaScript code and returns structured feedback:
 * bugs, security issues, performance concerns, and improvement suggestions.
 *
 * Usage:
 *   const review = await reviewCode({ code, filename, context })
 *   // Show review.summary, review.issues, review.score in the UI
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface CodeReviewInput {
  code: string
  filename?: string          // e.g. "lib/auth.ts" — gives context to the model
  context?: string           // optional description of what the code is supposed to do
  language?: string          // defaults to TypeScript if not specified
}

const IssueSchema = z.object({
  severity: z.enum(["critical", "warning", "suggestion"]).describe(
    "critical = bug/security risk, warning = code smell/perf, suggestion = improvement"
  ),
  category: z.enum(["bug", "security", "performance", "maintainability", "style", "correctness"]),
  line: z.number().nullable().describe("Approximate line number, or null if not applicable"),
  title: z.string().describe("Short title for the issue, e.g. 'SQL injection risk'"),
  description: z.string().describe("Clear explanation of the problem"),
  suggestion: z.string().describe("Concrete fix or improvement to apply"),
})

const CodeReviewSchema = z.object({
  summary: z.string().describe(
    "2-3 sentence overall assessment of the code quality"
  ),
  score: z.number().min(0).max(10).describe(
    "Overall code quality score: 0 = broken, 10 = excellent"
  ),
  issues: z.array(IssueSchema).describe(
    "All issues found, ordered by severity (critical first)"
  ),
  criticalCount: z.number().describe("Number of critical issues"),
  warningCount: z.number().describe("Number of warnings"),
  suggestionCount: z.number().describe("Number of suggestions"),
  approved: z.boolean().describe(
    "True if the code is safe to merge (no critical issues)"
  ),
  highlights: z.array(z.string()).describe(
    "Things done well in this code — positive feedback"
  ),
})

export type CodeIssue = z.infer<typeof IssueSchema>
export type CodeReview = z.infer<typeof CodeReviewSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function reviewCode(input: CodeReviewInput): Promise<CodeReview> {
  const { code, filename, context, language = "TypeScript" } = input

  if (!code.trim()) {
    return {
      summary: "No code provided for review.",
      score: 0,
      issues: [],
      criticalCount: 0,
      warningCount: 0,
      suggestionCount: 0,
      approved: false,
      highlights: [],
    }
  }

  const prompt = `
You are a senior software engineer performing a thorough code review.

${filename ? `File: ${filename}` : ""}
Language: ${language}
${context ? `Context: ${context}` : ""}

Review the following code for:
- **Bugs** — logic errors, off-by-one, null/undefined issues, incorrect assumptions
- **Security** — injection risks, exposed secrets, missing auth checks, unsafe inputs
- **Performance** — unnecessary loops, N+1 queries, blocking operations, memory leaks
- **Maintainability** — overly complex logic, missing error handling, unclear naming
- **Correctness** — does the code do what it appears to intend?
- **Style** — inconsistencies, dead code, unused imports

Scoring guide:
- 9-10: Production-ready, clean, no real issues
- 7-8: Good code with minor improvements
- 5-6: Works but has notable warnings
- 3-4: Has bugs or significant problems
- 0-2: Critical issues, not safe to deploy

Also note what the code does well — balanced feedback is more useful.

\`\`\`${language.toLowerCase()}
${code}
\`\`\`
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(CodeReviewSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Code review failed: no structured output returned")
  }

  const review = response.parsed_output

  // Sort issues: critical first, then warnings, then suggestions
  const order = { critical: 0, warning: 1, suggestion: 2 }
  review.issues.sort((a, b) => order[a.severity] - order[b.severity])

  return review
}
