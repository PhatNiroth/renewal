/**
 * Spend Optimization Agent  (replaces plan-recommendation.agent.ts)
 *
 * Analyzes the company's subscription portfolio and surfaces actionable
 * cost optimization opportunities: billing cycle upgrades, duplicate
 * vendor consolidation, unused/cancelled subscriptions still being paid,
 * and upcoming high-cost renewals worth renegotiating.
 *
 * Usage:
 *   const report = await analyzeSpend(portfolio)
 *   // Show report.opportunities on the admin overview or analytics page
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface SubscriptionPortfolioItem {
  id: string
  vendorName: string
  category: string          // "SAAS" | "CONTRACT" | "GOVERNMENT" | "UTILITY" | "OTHER"
  planName: string
  cost: number              // in cents
  billingCycle: string      // "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME"
  status: string
  daysUntilRenewal: number
  hasPaymentRecords: boolean
  monthsActive: number      // how long this subscription has been active
}

export interface SpendOptimizationInput {
  subscriptions: SubscriptionPortfolioItem[]
  totalMonthlySpend: number   // in cents, normalised
}

const OpportunitySchema = z.object({
  type: z.enum([
    "switch_to_yearly",       // monthly subscription that would save on yearly billing
    "consolidate_vendors",    // multiple vendors in same category — could consolidate
    "review_unused",          // subscription with no payment records — possibly unused
    "renegotiate_renewal",    // high-cost renewal coming soon — opportunity to renegotiate
    "cancel_redundant",       // subscription that appears redundant given another active one
    "missing_payment_record", // active paid subscription with no recorded payments
  ]),
  title: z.string().describe("Short title for this opportunity, e.g. 'Switch DigitalOcean to yearly billing'"),
  description: z.string().describe("1-2 sentence explanation of the opportunity and why it matters"),
  estimatedSaving: z.string().nullable().describe("Estimated saving if actioned, e.g. '$180/year' or null if saving is unclear"),
  affectedSubscriptionIds: z.array(z.string()).describe("IDs of the subscriptions this applies to"),
  effort: z.enum(["low", "medium", "high"]).describe("Effort required to action this opportunity"),
  priority: z.number().describe("1 = highest priority, higher numbers = lower priority"),
})

const SpendOptimizationSchema = z.object({
  opportunities: z.array(OpportunitySchema),
  summary: z.string().describe("1-2 sentence executive summary of the portfolio's optimization potential"),
  totalEstimatedSavings: z.string().describe("Overall estimated savings if all opportunities are actioned, e.g. '$3,200/year'"),
  portfolioObservations: z.array(z.string()).describe("General observations about the subscription portfolio (e.g. 'SaaS dominates at 80% of spend')"),
})

export type SpendOpportunity = z.infer<typeof OpportunitySchema>
export type SpendOptimizationReport = z.infer<typeof SpendOptimizationSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function analyzeSpend(
  input: SpendOptimizationInput
): Promise<SpendOptimizationReport> {
  if (input.subscriptions.length === 0) {
    return {
      opportunities: [],
      summary: "No subscriptions to analyze.",
      totalEstimatedSavings: "$0",
      portfolioObservations: [],
    }
  }

  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`

  const cycleLabel: Record<string, string> = {
    MONTHLY: "monthly", QUARTERLY: "quarterly", YEARLY: "yearly", ONE_TIME: "one-time",
  }

  const portfolioRows = input.subscriptions
    .map(s => `
- ID: ${s.id}
  Vendor: ${s.vendorName} | Category: ${s.category}
  Plan: ${s.planName} | Cost: ${fmt(s.cost)} (${cycleLabel[s.billingCycle] ?? s.billingCycle})
  Status: ${s.status} | Renewal in: ${s.daysUntilRenewal} days
  Active for: ${s.monthsActive} month(s) | Has payment records: ${s.hasPaymentRecords ? "Yes" : "No"}`.trim()
    )
    .join("\n\n")

  const prompt = `
You are a procurement consultant reviewing a company's external subscription portfolio.

Total portfolio monthly spend: ${fmt(input.totalMonthlySpend)}/month
Total subscriptions: ${input.subscriptions.length}

Your task is to identify specific, actionable cost optimization opportunities.

Look for:
1. **Yearly savings**: Monthly subscriptions active for 6+ months — switching to yearly typically saves 15-20%. Calculate estimated savings.
2. **Vendor consolidation**: Multiple subscriptions in the same category (e.g. two SaaS tools doing similar things) — flag for review.
3. **Unused subscriptions**: Active/paid subscriptions with no payment records ever logged — may be unused or untracked.
4. **Renegotiation opportunities**: High-cost subscriptions (>$500/mo equivalent) renewing within 30 days — good time to renegotiate.
5. **Missing payment records**: Paid subscriptions with no payment history — creates financial blind spots.
6. **Cancelled but possibly duplicate coverage**: Recently cancelled subscriptions where another in the same category is still active.

For each opportunity:
- Be specific about which subscription(s) it applies to (use the IDs)
- Give a realistic estimated saving where calculable (yearly savings = monthly cost × 1.6 for yearly switch, or flag as "varies" for soft opportunities)
- Rank by priority: quick wins with clear savings first

Portfolio:

${portfolioRows}

Be conservative and data-driven. Only flag genuine opportunities based on the data provided.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(SpendOptimizationSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Spend optimization failed: no structured output returned")
  }

  // Sort opportunities by priority
  response.parsed_output.opportunities.sort((a, b) => a.priority - b.priority)

  return response.parsed_output
}
