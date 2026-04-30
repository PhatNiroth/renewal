/**
 * Senior QA Reviewer Agent
 *
 * Reviews a feature or code file from a Senior QA Engineer perspective.
 * Identifies test gaps, untested edge cases, regression risks, and
 * validation holes. Outputs a ready-to-use test checklist.
 *
 * Usage:
 *   const review = await reviewQA({ code, filename, featureDescription })
 *   // review.testCases can be handed directly to the test generator
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface QAReviewInput {
  code: string
  filename?: string
  featureDescription?: string   // plain-English description of what this should do
  existingTests?: string        // content of existing test file, if any
}

const TestCaseSchema = z.object({
  name: z.string().describe("Test name as it would appear in describe/it block"),
  category: z.enum([
    "happy_path",       // normal successful flow
    "error_handling",   // what happens when things go wrong
    "edge_case",        // boundary values, empty inputs, nulls
    "auth",             // unauthorized access, wrong user, missing session
    "validation",       // invalid inputs, type mismatches, missing required fields
    "regression",       // specific scenario that could break existing behavior
    "concurrency",      // race conditions, duplicate submissions
  ]),
  priority: z.enum(["must_have", "should_have", "nice_to_have"]),
  scenario: z.string().describe("Exact scenario to test — input conditions"),
  expectedOutcome: z.string().describe("What should happen — return value, DB state, error thrown"),
  alreadyCovered: z.boolean().describe("True if existing tests already cover this case"),
})

const QAReviewSchema = z.object({
  summary: z.string().describe("2-3 sentence QA assessment — overall test confidence level"),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).describe(
    "Risk of shipping without additional tests"
  ),
  approved: z.boolean().describe("True if test coverage is sufficient to ship confidently"),
  testCases: z.array(TestCaseSchema).describe("All test cases — covered and missing"),
  missingMustHave: z.number().describe("Count of must-have test cases not yet written"),
  coverageGaps: z.array(z.string()).describe("Specific code paths or scenarios with no test coverage"),
  regressionRisks: z.array(z.string()).describe("Existing features that could break due to this change"),
  validationGaps: z.array(z.string()).describe("Input validations missing from the code itself"),
  suggestedTestFile: z.string().describe("Recommended path for the test file, e.g. __tests__/actions/subscriptions.test.ts"),
  prioritizedActions: z.array(z.string()).describe("Top 3 things to test or fix before shipping"),
})

export type QATestCase = z.infer<typeof TestCaseSchema>
export type QAReview = z.infer<typeof QAReviewSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function reviewQA(input: QAReviewInput): Promise<QAReview> {
  const { code, filename, featureDescription, existingTests } = input

  if (!code.trim()) {
    return {
      summary: "No code provided for QA review.",
      riskLevel: "critical",
      approved: false,
      testCases: [],
      missingMustHave: 0,
      coverageGaps: [],
      regressionRisks: [],
      validationGaps: [],
      suggestedTestFile: "__tests__/unknown.test.ts",
      prioritizedActions: [],
    }
  }

  const prompt = `
You are a Senior QA Engineer with deep expertise in TypeScript, Next.js Server Actions, and API route testing.
You work on an internal subscription management system used by Operations and Accounting.
The test framework is Vitest. The database is PostgreSQL via Prisma — tests use real DB queries, no mocks.

${filename ? `File under review: ${filename}` : ""}
${featureDescription ? `Feature description: ${featureDescription}` : ""}

${existingTests ? `Existing tests:\n\`\`\`ts\n${existingTests}\n\`\`\`` : "No existing tests provided."}

Review this code and identify:

**Happy Path Tests**
- Does the normal successful flow have a test?
- Are success return values verified?

**Error & Edge Cases**
- What happens with empty/null inputs?
- What happens at boundary values (0, negative numbers, very long strings)?
- What if the DB record doesn't exist?
- What if required env vars are missing?

**Auth & Permission Tests**
- Can an unauthenticated user call this?
- Can a user access another user's data?
- Are admin-only operations tested for regular users?

**Validation Tests**
- Are all required fields validated?
- Are invalid types rejected?
- Are business rules enforced (e.g. renewal date must be future)?

**Regression Risks**
- What existing behavior could this change break?
- Are there shared DB records or state that tests could interfere with?

**Concurrency & Race Conditions**
- Can this be called twice simultaneously causing duplicate records?
- Is there a TOCTOU (time-of-check-time-of-use) risk?

Risk level guide:
- low: Well-tested, minor edge cases missing
- medium: Some important paths untested
- high: Core flows or auth checks untested
- critical: No tests, or auth/security paths completely uncovered

\`\`\`typescript
${code}
\`\`\`
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(QAReviewSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("QA review failed: no structured output returned")
  }

  const review = response.parsed_output
  const priorityOrder = { must_have: 0, should_have: 1, nice_to_have: 2 }
  review.testCases.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return review
}
