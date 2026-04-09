/**
 * Spend Analytics Agent
 *
 * Transforms raw subscription and payment data into a plain-English
 * procurement summary for internal management review. Identifies cost
 * trends, upcoming renewal exposure, and category breakdowns.
 *
 * Usage:
 *   const insight = await generateAnalyticsSummary(metrics)
 *   // Render insight.headline + insight.summary on the admin overview page
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface AnalyticsMetrics {
  // Subscriptions
  totalSubscriptions: number
  activeSubscriptions: number
  expiringIn7Days: number
  expiringIn30Days: number
  expiredUnattended: number     // EXPIRED status with no recent payment
  cancelledCount: number

  // Spend (all values in cents)
  estimatedMonthlySpend: number   // sum of active subscriptions normalised to monthly
  estimatedYearlySpend: number    // monthly * 12
  totalPaidThisYear: number       // sum of Payment records for current calendar year
  totalPaidAllTime: number        // sum of all Payment records

  // Upcoming renewal exposure
  renewalExposure7Days: number    // total cost of subscriptions renewing in 7 days (cents)
  renewalExposure30Days: number   // total cost of subscriptions renewing in 30 days (cents)

  // Category breakdown
  categoryBreakdown: {
    category: string              // "SAAS" | "CONTRACT" | "GOVERNMENT" | "UTILITY" | "OTHER"
    count: number
    monthlySpend: number          // cents, normalised
  }[]

  // Top vendors by cost
  topVendors: {
    vendorName: string
    monthlySpend: number          // cents, normalised
    subscriptionCount: number
  }[]

  // Period
  periodLabel: string             // e.g. "April 2026"
}

const AnalyticsSummarySchema = z.object({
  headline: z.string().describe(
    "One punchy headline for the period, e.g. 'Renewal pressure high — $8,500 due in 7 days'"
  ),
  summary: z.string().describe(
    "2-3 sentence plain-English paragraph summarising overall subscription health and spend"
  ),
  alerts: z.array(z.string()).describe(
    "Issues requiring immediate attention, e.g. '3 subscriptions expired with no action taken'"
  ),
  positives: z.array(z.string()).describe(
    "Things in good shape worth noting, e.g. 'All active subscriptions have a responsible person assigned'"
  ),
  spendTrend: z.enum(["increasing", "stable", "decreasing", "unknown"]),
  healthScore: z.number().min(0).max(100).describe(
    "Overall procurement health score 0-100 based on renewal coverage, spend clarity, and expiry risk"
  ),
  recommendedFocus: z.string().describe(
    "The single most important action for the team this period"
  ),
  costInsights: z.array(z.string()).describe(
    "Specific data-backed cost observations, e.g. 'SaaS accounts for 72% of monthly spend'"
  ),
})

export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function generateAnalyticsSummary(
  metrics: AnalyticsMetrics
): Promise<AnalyticsSummary> {
  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`

  const categoryRows = metrics.categoryBreakdown
    .map(c => `  - ${c.category}: ${c.count} subscription(s), ${fmt(c.monthlySpend)}/mo`)
    .join("\n")

  const topVendorRows = metrics.topVendors
    .slice(0, 5)
    .map((v, i) => `  ${i + 1}. ${v.vendorName} — ${fmt(v.monthlySpend)}/mo (${v.subscriptionCount} sub${v.subscriptionCount !== 1 ? "s" : ""})`)
    .join("\n")

  const prompt = `
You are a procurement analyst reviewing a company's internal subscription data.

Generate a concise management summary for: ${metrics.periodLabel}

--- SUBSCRIPTION OVERVIEW ---
Total subscriptions tracked: ${metrics.totalSubscriptions}
Active: ${metrics.activeSubscriptions}
Expiring in 7 days: ${metrics.expiringIn7Days}
Expiring in 30 days: ${metrics.expiringIn30Days}
Expired without action: ${metrics.expiredUnattended}
Cancelled: ${metrics.cancelledCount}

--- SPEND ---
Estimated monthly spend (all active): ${fmt(metrics.estimatedMonthlySpend)}
Estimated annual spend: ${fmt(metrics.estimatedYearlySpend)}
Total paid this year (recorded): ${fmt(metrics.totalPaidThisYear)}
Total paid all time (recorded): ${fmt(metrics.totalPaidAllTime)}

--- UPCOMING RENEWAL EXPOSURE ---
Amount due in next 7 days: ${fmt(metrics.renewalExposure7Days)}
Amount due in next 30 days: ${fmt(metrics.renewalExposure30Days)}

--- SPEND BY CATEGORY ---
${categoryRows || "  (no data)"}

--- TOP VENDORS BY MONTHLY COST ---
${topVendorRows || "  (no data)"}

---

Write an honest, actionable summary for management. Focus on:
- Renewal risk (are subscriptions expiring without attention?)
- Spend clarity (is total spend known and accounted for?)
- Operational gaps (expired subs, unassigned responsible persons, etc.)
- Category or vendor concentration risk

The health score should reflect real risk: unattended expiries, missing payment records,
and high renewal exposure with no assigned owners should lower the score.
Keep the tone professional and direct — this is read by management, not IT.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(AnalyticsSummarySchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Analytics summary failed: no structured output returned")
  }

  return response.parsed_output
}
