/**
 * Planner Agent
 *
 * Takes a plain-English feature request and breaks it into specific,
 * ordered coding tasks before any code is written. Designed for this
 * project's stack: Next.js 16.2.2, TypeScript, Prisma 5, NextAuth v5,
 * Tailwind CSS v4.
 *
 * Usage:
 *   const plan = await planFeature({ request, context })
 *   // Pass plan.steps one by one to the Code Generator Agent
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface PlannerInput {
  request: string           // plain-English feature request
  context?: string          // optional: existing code or page this relates to
  affectedArea?: string     // optional: e.g. "subscriptions", "admin panel", "billing"
}

const StepSchema = z.object({
  stepNumber: z.number().describe("Order of this step, starting at 1"),
  title: z.string().describe("Short title, e.g. 'Add GET /api/export/subscriptions route'"),
  description: z.string().describe("What needs to be built in this step and why"),
  fileToCreate: z.string().nullable().describe("File path to create, e.g. 'app/api/export/subscriptions/route.ts', or null if editing"),
  fileToEdit: z.string().nullable().describe("File path to edit, e.g. 'app/dashboard/subscriptions/page.tsx', or null if creating"),
  type: z.enum([
    "api_route",
    "server_action",
    "page",
    "component",
    "lib_utility",
    "prisma_schema",
    "agent",
    "other",
  ]).describe("What kind of code this step involves"),
  dependsOn: z.array(z.number()).describe("Step numbers this step depends on (must be done first)"),
  estimatedComplexity: z.enum(["low", "medium", "high"]).describe(
    "low = simple change, medium = moderate logic, high = complex with multiple concerns"
  ),
  notes: z.string().nullable().describe("Any important notes, gotchas, or constraints for this step"),
})

const PlanSchema = z.object({
  featureSummary: z.string().describe("One sentence summary of what is being built"),
  steps: z.array(StepSchema).describe("Ordered list of coding tasks to implement the feature"),
  totalSteps: z.number(),
  estimatedComplexity: z.enum(["low", "medium", "high"]).describe("Overall complexity of the full feature"),
  prismaChangesRequired: z.boolean().describe("True if schema.prisma needs to be modified"),
  newDependenciesRequired: z.array(z.string()).describe("npm packages that need to be installed, if any"),
  warnings: z.array(z.string()).describe("Potential risks or things to be careful about"),
})

export type PlanStep = z.infer<typeof StepSchema>
export type FeaturePlan = z.infer<typeof PlanSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function planFeature(input: PlannerInput): Promise<FeaturePlan> {
  const { request, context, affectedArea } = input

  const prompt = `
You are a senior software architect planning a feature for an internal subscription management system.

Tech stack (strict — do not suggest alternatives):
- Next.js 16.2.2 (App Router) — Server Components by default, "use client" only when needed
- TypeScript strict mode — @/* alias maps to project root
- Tailwind CSS v4 — @import "tailwindcss" syntax
- Prisma 5 + PostgreSQL on port 5436
- NextAuth v5 beta — Credentials provider, JWT strategy
- Resend for email
- Anthropic SDK for AI agents

Project structure:
- app/dashboard/          → authenticated user pages
- app/dashboard/admin/    → admin-only pages
- app/api/                → API routes
- app/actions/            → Server Actions (preferred for mutations)
- agents/                 → AI agent files
- lib/                    → shared utilities (db.ts, auth.ts, email.ts)
- components/ui/          → button, input, card, badge, modal

Key rules:
- Prefer Server Actions over API routes for form mutations
- Always call revalidatePath() after DB writes
- Never instantiate new PrismaClient() — use lib/db.ts singleton
- All money values stored as cents (integers)
- Dynamic route params are async: const { id } = await params
- Middleware uses edge-safe auth config from auth.config.ts — no Prisma there

Feature request: ${request}
${affectedArea ? `Affected area: ${affectedArea}` : ""}
${context ? `\nAdditional context:\n${context}` : ""}

Break this feature into specific, ordered coding tasks. Each step should be small enough
to implement in one focused coding session. Order them so dependencies come first.
Flag any risks, schema changes, or new packages needed.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(PlanSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Planner failed: no structured output returned")
  }

  return response.parsed_output
}
