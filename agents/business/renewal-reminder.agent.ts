/**
 * Renewal Reminder Agent
 *
 * Generates an internal staff notification email when a company subscription
 * is approaching its renewal date. The email goes to Operations / Accounting
 * staff — not to an external customer.
 *
 * Usage:
 *   const email = await generateRenewalEmail({ vendor, subscription, recipients, daysUntilRenewal })
 *   await sendEmail(recipients.map(r => r.email), email.subject, email.bodyText)
 */

import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface RenewalReminderInput {
  vendor: {
    name: string
    category: string        // "SAAS" | "CONTRACT" | "GOVERNMENT" | "UTILITY" | "OTHER"
    website?: string | null
  }
  subscription: {
    planName: string        // e.g. "Business Plan", "Enterprise License"
    cost: number            // in cents
    billingCycle: string    // "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME"
    renewalDate: Date
    notes?: string | null
  }
  responsible?: {
    name: string
    email: string
  } | null
  recipients: {
    name: string
    email: string
    role: string            // "ADMIN" | "OPERATIONS" | "ACCOUNTING"
  }[]
  daysUntilRenewal: number
}

const RenewalEmailSchema = z.object({
  subject: z.string().describe("Email subject line, clear and action-oriented for internal staff"),
  preheader: z.string().describe("Preview text shown in inbox (90 chars max)"),
  headline: z.string().describe("Main heading inside the email, e.g. 'Action Required: Anthropic renewal in 3 days'"),
  bodyText: z.string().describe("2-3 paragraph plain-English body for internal staff — no HTML. Include vendor name, cost, renewal date, and what action is needed."),
  actionItems: z.array(z.string()).describe("Concrete steps the recipient should take, e.g. 'Confirm budget approval', 'Update payment method if needed'"),
  urgency: z.enum(["low", "medium", "high", "critical"]).describe("Urgency level based on days until renewal and cost"),
  tone: z.enum(["informational", "action-required", "urgent"]),
})

export type RenewalEmail = z.infer<typeof RenewalEmailSchema>

// ─── Agent ───────────────────────────────────────────────────────────────────

export async function generateRenewalEmail(
  input: RenewalReminderInput
): Promise<RenewalEmail> {
  const { vendor, subscription, responsible, recipients, daysUntilRenewal } = input

  const costFormatted = `$${(subscription.cost / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
  const cycleLabel: Record<string, string> = {
    MONTHLY: "monthly", QUARTERLY: "quarterly", YEARLY: "yearly", ONE_TIME: "one-time",
  }
  const cycle = cycleLabel[subscription.billingCycle] ?? subscription.billingCycle.toLowerCase()

  const renewalDateStr = subscription.renewalDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  const recipientNames = recipients.map(r => r.name).join(", ")
  const urgencyContext = daysUntilRenewal <= 1
    ? "CRITICAL — renewal is today or tomorrow"
    : daysUntilRenewal <= 3
      ? "URGENT — renewal in under 3 days"
      : daysUntilRenewal <= 7
        ? "Action needed — renewal this week"
        : "Upcoming renewal — review and plan"

  const prompt = `
You are writing an internal renewal reminder email for the operations and accounting team of a company.

This is NOT a customer-facing email. It goes to internal staff who manage the company's external subscriptions.

Subscription details:
- Vendor: ${vendor.name} (${vendor.category})
- Service: ${subscription.planName}
- Cost: ${costFormatted} (${cycle})
- Renewal date: ${renewalDateStr}
- Days until renewal: ${daysUntilRenewal}
- Urgency context: ${urgencyContext}
- Responsible person: ${responsible ? `${responsible.name} (${responsible.email})` : "Not assigned"}
- Recipients: ${recipientNames}
${subscription.notes ? `- Notes: ${subscription.notes}` : ""}

Write a professional internal email that:
- Clearly states which vendor and service is renewing
- States the exact cost and date
- Lists specific action items (e.g. confirm payment method, get budget approval, decide on renewal vs cancellation)
- Mentions who is responsible for this subscription
- Matches the urgency — be more direct and assertive for critical/urgent renewals
- Keeps it concise — internal staff don't need lengthy explanations
- Does NOT say "Dear Customer" or use any customer-facing language

Plain text only in bodyText — no HTML tags.
`.trim()

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(RenewalEmailSchema),
    },
  })

  if (!response.parsed_output) {
    throw new Error("Failed to generate renewal email: no structured output returned")
  }

  return response.parsed_output
}
