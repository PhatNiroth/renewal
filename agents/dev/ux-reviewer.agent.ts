/**
 * Senior UX/UI Reviewer Agent
 *
 * Reviews React/Next.js UI components from a Senior UX/UI Designer perspective.
 * Flags usability issues, missing states, accessibility gaps, visual hierarchy
 * problems, and mobile layout concerns.
 *
 * Usage:
 *   const review = await reviewUX({ code, filename, context })
 *   // review.approved === false means UX issues block shipping
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface UXReviewInput {
  code: string
  filename?: string
  context?: string        // what this UI is supposed to do / who uses it
  pageType?: string       // e.g. "list page", "form", "modal", "dashboard"
}

const UXIssueSchema = z.object({
  severity: z.enum(["critical", "warning", "suggestion"]).describe(
    "critical = blocks usability, warning = hurts UX, suggestion = polish/improvement"
  ),
  category: z.enum([
    "missing_state",      // empty state, loading state, error state not handled
    "accessibility",      // missing aria, low contrast, keyboard nav, focus management
    "mobile_layout",      // not responsive, overflow, touch targets too small
    "visual_hierarchy",   // unclear primary action, poor information structure
    "feedback",           // missing success/error feedback to user
    "copy",               // confusing labels, vague button text, unhelpful messages
    "flow",               // confusing user journey, dead ends, unexpected navigation
    "performance_feel",   // no loading indicator, janky transitions
  ]),
  location: z.string().nullable().describe("Component name or line number where the issue is"),
  title: z.string().describe("Short title, e.g. 'Empty state missing'"),
  description: z.string().describe("What the problem is and why it hurts the user"),
  fix: z.string().describe("Specific, actionable fix — code change or design decision"),
  example: z.string().nullable().describe("JSX example showing the fix, if helpful"),
})

const UXReviewSchema = z.object({
  summary: z.string().describe("2-3 sentence overall UX assessment from a senior designer perspective"),
  score: z.number().min(0).max(10).describe(
    "UX quality score: 10 = ship it, 7-9 = minor polish, 5-6 = needs work, below 5 = rethink"
  ),
  approved: z.boolean().describe("True if UX is good enough to ship — no critical issues"),
  issues: z.array(UXIssueSchema).describe("All UX issues, ordered by severity"),
  criticalCount: z.number(),
  warningCount: z.number(),
  suggestionCount: z.number(),
  missingStates: z.array(z.string()).describe("UI states not handled: e.g. 'empty list', 'loading', 'error', 'offline'"),
  positives: z.array(z.string()).describe("What this UI does well"),
  prioritizedFixes: z.array(z.string()).describe("Top 3 most impactful fixes the developer should do first"),
})

export type UXIssue = z.infer<typeof UXIssueSchema>
export type UXReview = z.infer<typeof UXReviewSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function reviewUX(input: UXReviewInput): Promise<UXReview> {
  const { code, filename, context, pageType } = input

  if (!code.trim()) {
    return {
      summary: "No code provided for UX review.",
      score: 0,
      approved: false,
      issues: [],
      criticalCount: 0,
      warningCount: 0,
      suggestionCount: 0,
      missingStates: [],
      positives: [],
      prioritizedFixes: [],
    }
  }

  const prompt = `
You are a Senior UX/UI Designer with 10+ years of experience building B2B SaaS products.
You are reviewing a React/Next.js component for a subscription management internal tool used by Operations and Accounting teams.

${filename ? `File: ${filename}` : ""}
${pageType ? `Page type: ${pageType}` : ""}
${context ? `Context: ${context}` : ""}

Tech stack: Next.js 16, TypeScript, Tailwind CSS v4, Remix Icons.
Users are internal staff — not customers. They need efficiency, clarity, and trust.

Review this component for:

**Missing UI States** (most common critical issue)
- Empty state: what shows when there's no data?
- Loading state: is there a skeleton or spinner?
- Error state: what if the action fails?
- Disabled state: are buttons disabled when appropriate?

**Accessibility**
- Keyboard navigation works?
- ARIA labels on icon-only buttons?
- Color contrast sufficient (WCAG AA)?
- Focus management in modals/dialogs?

**Mobile & Responsive Layout**
- Does it work on smaller screens?
- Touch targets >= 44px?
- No horizontal overflow?

**Visual Hierarchy & Clarity**
- Is the primary action obvious?
- Are destructive actions (delete) clearly distinguished?
- Is information grouped logically?

**User Feedback**
- Does the user know when an action succeeds or fails?
- Are loading states shown during async operations?

**Copy & Labels**
- Are button labels action-oriented (not just "Submit")?
- Are error messages helpful (not just "Error occurred")?
- Are empty states instructive (tell the user what to do)?

**Flow**
- Can the user complete the main task without confusion?
- Are there dead ends or missing back/cancel options?

Scoring:
- 9-10: Ship it — polished, all states handled, accessible
- 7-8: Minor polish needed, no blockers
- 5-6: Notable UX issues, some states missing
- 3-4: Significant problems, multiple missing states
- 0-2: Not ready — confusing or broken UX

\`\`\`tsx
${code}
\`\`\`
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(UXReviewSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("UX review failed: no structured output returned")
  }

  const review = response.parsed_output
  const order = { critical: 0, warning: 1, suggestion: 2 }
  review.issues.sort((a, b) => order[a.severity] - order[b.severity])

  return review
}
