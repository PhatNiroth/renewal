/**
 * Test Generator Agent
 *
 * Generates TypeScript tests for a given piece of code.
 * Focuses on unit tests for lib utilities and Server Actions,
 * and integration-style tests for API routes.
 *
 * Usage:
 *   const tests = await generateTests({ code, filename, framework })
 *   // Write tests.testCode to the appropriate __tests__ file
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface TestGeneratorInput {
  code: string              // the code to generate tests for
  filename: string          // e.g. "app/actions/subscriptions.ts"
  framework?: string        // test framework — defaults to "vitest"
  context?: string          // optional extra context about what the code does
}

const TestCaseSchema = z.object({
  name: z.string().describe("Test name, e.g. 'returns error if user is not authenticated'"),
  category: z.enum([
    "happy_path",     // expected successful flow
    "error_handling", // error cases and edge cases
    "auth",           // authentication and authorization
    "validation",     // input validation
    "edge_case",      // boundary conditions
  ]),
  description: z.string().describe("What this test verifies"),
})

const TestGeneratorSchema = z.object({
  testCode: z.string().describe("Complete test file content ready to write to disk"),
  testFilePath: z.string().describe("Suggested file path, e.g. '__tests__/actions/subscriptions.test.ts'"),
  testCases: z.array(TestCaseSchema).describe("Summary of all test cases covered"),
  totalTests: z.number(),
  mockedDependencies: z.array(z.string()).describe("Dependencies that are mocked in these tests"),
  setupRequired: z.string().nullable().describe("Any setup needed before running tests, e.g. 'npx prisma migrate reset --force'"),
  coverageNotes: z.string().describe("What is and isn't covered by these tests"),
})

export type GeneratedTests = z.infer<typeof TestGeneratorSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function generateTests(input: TestGeneratorInput): Promise<GeneratedTests> {
  const { code, filename, framework = "vitest", context } = input

  const prompt = `
You are a senior TypeScript engineer writing tests for an internal subscription management system.

Tech stack:
- Test framework: ${framework}
- TypeScript strict mode
- Prisma 5 for database (use real queries — do NOT mock the database)
- NextAuth v5 for auth (mock the session)
- Next.js 16.2.2 App Router Server Actions and API routes

Testing rules for this project:
- Do NOT mock the database — test against real Prisma queries
- DO mock: auth session, external APIs (Resend, Stripe, Anthropic), file system
- Server Actions return { error: string } | { success: true } — test both branches
- API routes return NextResponse.json() — test status codes and response shape
- Test auth: unauthenticated, authenticated non-admin, authenticated admin
- Test validation: missing required fields, invalid formats, boundary values
- Use descriptive test names: "returns error if vendorId is missing"

File being tested: ${filename}
${context ? `\nContext: ${context}` : ""}

Code to test:
\`\`\`typescript
${code}
\`\`\`

Generate comprehensive tests covering:
1. Happy path — normal successful flow
2. Auth — unauthenticated and unauthorized cases
3. Validation — missing/invalid inputs
4. Error handling — DB errors, external service failures
5. Edge cases — empty data, boundary values

Write complete, runnable test code. Import paths should match the project structure.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 6144,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(TestGeneratorSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Test generation failed: no structured output returned")
  }

  return response.parsed_output
}
