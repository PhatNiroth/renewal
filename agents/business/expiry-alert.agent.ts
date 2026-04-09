/**
 * Expiry Alert Agent  (replaces churn-detection.agent.ts)
 *
 * Analyzes a batch of company subscriptions and identifies which ones need
 * attention before their renewal date — due to missing payments, unassigned
 * owners, high cost, or imminent expiry.
 *
 * Designed to run on a schedule (e.g. nightly) or triggered from the admin panel.
 *
 * Usage:
 *   const results = await detectExpiryRisk(subscriptions)
 *   const urgent = results.items.filter(r => r.riskLevel === "high")
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface ExpiryAlertInput {
  subscriptionId: string
  vendorName: string
  planName: string
  cost: number                  // in cents
  billingCycle: string          // "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME"
  status: string                // "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED" | "PENDING"
  daysUntilRenewal: number      // negative = already past renewal date
  hasResponsible: boolean       // is a responsible person assigned?
  lastPaymentDaysAgo: number | null  // null = no payment ever recorded
  hasNotes: boolean
}

const ExpiryAlertItemSchema = z.object({
  subscriptionId: z.string(),
  riskScore: z.number().min(0).max(100).describe("0 = no risk, 100 = immediate action required"),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  reasons: z.array(z.string()).describe("Specific signals driving this risk score"),
  suggestedAction: z.string().describe("Concrete action for the operations team to take"),
  priority: z.number().describe("Ordering hint: 1 = highest priority"),
})

const ExpiryAlertResultSchema = z.object({
  items: z.array(ExpiryAlertItemSchema),
  summary: z.string().describe("One paragraph overview of the batch — what needs attention most"),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  immediateActions: z.array(z.string()).describe("Top 3 actions the team should take today"),
})

export type ExpiryAlertItem = z.infer<typeof ExpiryAlertItemSchema>
export type ExpiryAlertResult = z.infer<typeof ExpiryAlertResultSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function detectExpiryRisk(
  subscriptions: ExpiryAlertInput[]
): Promise<ExpiryAlertResult> {
  if (subscriptions.length === 0) {
    return {
      items: [],
      summary: "No subscriptions provided for analysis.",
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      immediateActions: [],
    }
  }

  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`

  const cycleLabel: Record<string, string> = {
    MONTHLY: "monthly", QUARTERLY: "quarterly", YEARLY: "yearly", ONE_TIME: "one-time",
  }

  const subscriptionList = subscriptions
    .map((s, i) => `
[${i + 1}] ID: ${s.subscriptionId}
  Vendor: ${s.vendorName} | Plan: ${s.planName}
  Cost: ${fmt(s.cost)} (${cycleLabel[s.billingCycle] ?? s.billingCycle})
  Status: ${s.status} | Days until renewal: ${s.daysUntilRenewal < 0 ? `${Math.abs(s.daysUntilRenewal)} days overdue` : `${s.daysUntilRenewal} days`}
  Responsible assigned: ${s.hasResponsible ? "Yes" : "No"}
  Last payment recorded: ${s.lastPaymentDaysAgo === null ? "Never" : `${s.lastPaymentDaysAgo} days ago`}
  Has notes: ${s.hasNotes ? "Yes" : "No"}`.trim()
    )
    .join("\n\n")

  const prompt = `
You are a procurement risk analyst reviewing a company's external service subscriptions.

Analyze the following ${subscriptions.length} subscription(s) and score each for expiry/attention risk.

Risk signals to consider (in rough order of severity):
- Already expired or overdue (status=EXPIRED or daysUntilRenewal < 0) → critical
- No responsible person assigned + renewal within 7 days → high
- No payment ever recorded for a paid subscription → high
- Status=EXPIRING_SOON → high
- High-cost subscription (>$1,000/mo equivalent) renewing within 14 days → medium-high
- No payment in >90 days for a monthly subscription → medium
- No notes or context on a high-cost subscription → low-medium
- Renewal within 30 days with no assigned owner → medium

Risk levels: low (0-25), medium (26-50), high (51-75), critical (76-100)

For each subscription, give:
- A specific risk score and level
- The exact reasons based on the data provided
- A concrete, actionable suggestion for the operations team (e.g. "Assign responsible person and confirm payment method before Apr 15")

Prioritize items by urgency — the item most needing action today should have priority=1.

Subscriptions to analyze:

${subscriptionList}
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(ExpiryAlertResultSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Expiry alert failed: no structured output returned")
  }

  // Sort by priority ascending (1 = most urgent)
  response.parsed_output.items.sort((a, b) => a.priority - b.priority)

  return response.parsed_output
}
