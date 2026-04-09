/**
 * Documentation Agent
 *
 * Generates JSDoc comments, inline code comments, and a plain-English
 * summary for a given piece of code. Runs after Code Review approves
 * the code — documents what was actually built, not what was planned.
 *
 * Usage:
 *   const docs = await generateDocs({ code, filename, context })
 *   // Use docs.documentedCode as the final version of the file
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface DocumentationInput {
  code: string              // the reviewed and approved code
  filename: string          // e.g. "app/actions/subscriptions.ts"
  context?: string          // optional description of what this code does
}

const DocumentationSchema = z.object({
  documentedCode: z.string().describe(
    "The complete code with JSDoc comments and inline comments added. Do not change any logic — only add documentation."
  ),
  summary: z.string().describe(
    "Plain-English paragraph explaining what this file does, who uses it, and when it runs"
  ),
  exportedFunctions: z.array(
    z.object({
      name: z.string(),
      purpose: z.string().describe("One sentence: what this function does"),
      params: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string(),
      })),
      returns: z.string().describe("What the function returns"),
    })
  ).describe("Documentation for each exported function or component"),
  usageExample: z.string().describe(
    "A short code example showing how to use the main export of this file"
  ),
  notes: z.array(z.string()).describe(
    "Important notes for other developers, e.g. 'Must be called from Node.js runtime only'"
  ),
})

export type GeneratedDocs = z.infer<typeof DocumentationSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function generateDocs(input: DocumentationInput): Promise<GeneratedDocs> {
  const { code, filename, context } = input

  const prompt = `
You are a senior TypeScript engineer writing documentation for an internal
subscription management system.

File: ${filename}
${context ? `Context: ${context}` : ""}

Documentation rules for this project:
- Add JSDoc comments above every exported function, component, and type
- Add inline comments only where the logic is non-obvious — not on every line
- Keep comments concise and factual — describe WHY, not WHAT (the code shows what)
- DO NOT change any logic, imports, or code structure — only add documentation
- Use @param, @returns tags in JSDoc
- For Server Actions note: "@throws Never — returns { error } on failure"
- For API routes note the HTTP method and expected response shape
- For components note required props and when to use "use client"

Code to document:
\`\`\`typescript
${code}
\`\`\`

Return the complete file with documentation added. Every exported function must have a JSDoc block.
The logic must be identical to the input — only comments are added.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(DocumentationSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Documentation generation failed: no structured output returned")
  }

  return response.parsed_output
}
