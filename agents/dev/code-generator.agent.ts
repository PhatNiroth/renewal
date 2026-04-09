/**
 * Code Generator Agent
 *
 * Generates production-ready TypeScript code for a single step from the
 * Planner Agent's output. Designed to follow this project's exact conventions:
 * Next.js 16.2.2 App Router, Prisma 5, NextAuth v5, Tailwind CSS v4.
 *
 * Usage:
 *   const result = await generateCode({ step, projectContext })
 *   // Pass result.code to the Code Review Agent before using it
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface CodeGeneratorInput {
  task: string              // what to build — can be a planner step title + description
  fileType: string          // e.g. "API route", "Server Action", "React component", "lib utility"
  filePath: string          // target file path, e.g. "app/api/export/subscriptions/route.ts"
  existingCode?: string     // existing file content if editing rather than creating
  relatedCode?: string      // related files for context (e.g. the Prisma schema, existing actions)
  requirements?: string[]   // specific requirements this code must satisfy
}

const CodeGeneratorSchema = z.object({
  code: z.string().describe("The complete, production-ready TypeScript code for the file"),
  explanation: z.string().describe("2-3 sentence explanation of what the code does and key decisions made"),
  imports: z.array(z.string()).describe("List of packages imported that must be available"),
  newPackagesNeeded: z.array(z.string()).describe("npm packages that need to be installed (empty if none)"),
  envVarsNeeded: z.array(z.string()).describe("Environment variables this code requires (empty if none)"),
  followUpSteps: z.array(z.string()).describe("Things that must be done after this file is created, e.g. 'Run prisma migrate dev'"),
  warnings: z.array(z.string()).describe("Anything the developer should be aware of before using this code"),
})

export type GeneratedCode = z.infer<typeof CodeGeneratorSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function generateCode(input: CodeGeneratorInput): Promise<GeneratedCode> {
  const { task, fileType, filePath, existingCode, relatedCode, requirements } = input

  const prompt = `
You are a senior TypeScript engineer generating production-ready code for an internal
subscription management system.

Tech stack and strict rules:
- Next.js 16.2.2 App Router — Server Components by default
- Add "use client" only when: using useState/useEffect/event handlers/browser APIs
- TypeScript strict mode — no 'any' types, proper null handling
- Tailwind CSS v4 — use @import "tailwindcss", NOT @tailwind directives
- Prisma 5 — import db from "@/lib/db", NEVER new PrismaClient()
- NextAuth v5 — import auth from "@/lib/auth" for session (Node.js only, not edge)
- Server Actions: 'use server' at top, return { error: string } | { success: true }
- API routes: return NextResponse.json({ error }) with correct HTTP status on failure
- Always call revalidatePath() after DB writes in Server Actions
- Dynamic params: const { id } = await params (async in Next.js 16)
- Money: always store as cents (integers), format to dollars only in UI
- Icons: @remixicon/react only, Ri-prefixed
- UI components: @/components/ui/button, input, card, badge, modal

File to generate: ${filePath}
File type: ${fileType}

Task:
${task}

${requirements && requirements.length > 0 ? `Requirements:\n${requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : ""}

${relatedCode ? `\nRelated code for context:\n\`\`\`typescript\n${relatedCode}\n\`\`\`` : ""}

${existingCode ? `\nExisting file to modify:\n\`\`\`typescript\n${existingCode}\n\`\`\`` : ""}

Generate complete, working code. Do not leave TODOs or placeholders.
Follow the exact patterns of this codebase — no new abstractions, no extra packages
unless absolutely necessary, no features beyond what was asked.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(CodeGeneratorSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Code generation failed: no structured output returned")
  }

  return response.parsed_output
}
