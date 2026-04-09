/**
 * Internal Finance Assistant Agent
 *
 * A conversational agent that answers internal financial questions about the
 * company's subscriptions and payment history. Designed for Operations and
 * Accounting staff — not customer-facing.
 *
 * Tool use: looks up real payment records and subscription data from the DB.
 *
 * Usage:
 *   const result = await runBillingAssistant({ messages, context, ... })
 *   // Or stream it:
 *   await streamBillingAssistant(input, onText, onDone)
 */

import Anthropic from "@anthropic-ai/sdk"
import { anthropic, MODEL } from "../lib/client"

// ─── Input / Output types ────────────────────────────────────────────────────

export interface BillingContext {
  userName: string
  userEmail: string
  userRole: string    // "ADMIN" | "OPERATIONS" | "ACCOUNTING" | "VIEWER"
}

export interface PaymentRecord {
  id: string
  amount: number            // cents
  currency: string
  paidAt: Date
  note: string | null
  vendorName: string
  planName: string
  paidByName: string | null
}

export interface SubscriptionRecord {
  id: string
  vendorName: string
  planName: string
  cost: number              // cents
  billingCycle: string
  renewalDate: Date
  status: string
  responsibleName: string | null
}

export interface BillingAssistantInput {
  messages: Anthropic.MessageParam[]
  context: BillingContext
  // Injected DB lookups — keeps agent decoupled from Prisma
  listPayments: (limit?: number, vendorName?: string) => Promise<PaymentRecord[]>
  listSubscriptions: (status?: string) => Promise<SubscriptionRecord[]>
  getUpcomingRenewals: (withinDays: number) => Promise<SubscriptionRecord[]>
  getTotalSpend: (vendorName?: string) => Promise<{ total: number; currency: string }>
}

export interface BillingAssistantResult {
  text: string
  messages: Anthropic.MessageParam[]
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: BillingContext): string {
  return `
You are an internal finance assistant for a company's subscription management system.

You are helping: ${ctx.userName} (${ctx.userRole})
Your job is to answer questions about the company's external service subscriptions,
payment history, upcoming renewals, and total spend — based on real data from the database.

You have tools to look up:
- Payment records (what was paid, when, to which vendor)
- Active subscriptions (what services the company subscribes to)
- Upcoming renewals (what needs to be paid soon)
- Total spend summaries (how much is being spent overall or by vendor)

Guidelines:
- Always use tools to get real data before answering — never guess amounts or dates
- Format all amounts in dollars (e.g. "$500.00"), never in cents
- Be concise and direct — internal staff want facts, not long explanations
- If asked about a specific vendor, look up their subscriptions and payments
- If you cannot find something, say so clearly rather than guessing
- For questions outside your scope (e.g. HR, legal), politely redirect to the relevant team
`.trim()
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "list_payments",
    description: "List recent payment records. Optionally filter by vendor name. Use to answer questions about payment history.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of payments to return (default 10, max 50)" },
        vendor_name: { type: "string", description: "Filter by vendor name (partial match, optional)" },
      },
      required: [],
    },
  },
  {
    name: "list_subscriptions",
    description: "List the company's subscriptions. Optionally filter by status (ACTIVE, EXPIRED, CANCELLED, etc).",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status: ACTIVE, EXPIRING_SOON, EXPIRED, CANCELLED, PENDING (optional)" },
      },
      required: [],
    },
  },
  {
    name: "get_upcoming_renewals",
    description: "Get subscriptions renewing within a specified number of days. Use for questions like 'what's due this week?'",
    input_schema: {
      type: "object" as const,
      properties: {
        within_days: { type: "number", description: "Number of days to look ahead (e.g. 7, 14, 30)" },
      },
      required: ["within_days"],
    },
  },
  {
    name: "get_total_spend",
    description: "Get the total amount recorded across all payments, optionally filtered by vendor. Use to answer 'how much have we spent' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        vendor_name: { type: "string", description: "Filter by vendor name (optional — omit for company-wide total)" },
      },
      required: [],
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────

function fmtAmount(cents: number, currency = "usd") {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`
}

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  input: BillingAssistantInput
): Promise<string> {
  try {
    if (toolName === "list_payments") {
      const limit = Math.min((toolInput.limit as number) ?? 10, 50)
      const vendorName = toolInput.vendor_name as string | undefined
      const payments = await input.listPayments(limit, vendorName)
      if (payments.length === 0) return "No payment records found."
      return JSON.stringify(
        payments.map(p => ({
          id: p.id,
          vendor: p.vendorName,
          plan: p.planName,
          amount: fmtAmount(p.amount, p.currency),
          paidOn: p.paidAt.toISOString().split("T")[0],
          paidBy: p.paidByName ?? "Unknown",
          note: p.note ?? null,
        }))
      )
    }

    if (toolName === "list_subscriptions") {
      const status = toolInput.status as string | undefined
      const subs = await input.listSubscriptions(status)
      if (subs.length === 0) return "No subscriptions found."
      return JSON.stringify(
        subs.map(s => ({
          id: s.id,
          vendor: s.vendorName,
          plan: s.planName,
          cost: fmtAmount(s.cost),
          cycle: s.billingCycle,
          renewalDate: s.renewalDate.toISOString().split("T")[0],
          status: s.status,
          responsible: s.responsibleName ?? "Unassigned",
        }))
      )
    }

    if (toolName === "get_upcoming_renewals") {
      const withinDays = (toolInput.within_days as number) ?? 30
      const renewals = await input.getUpcomingRenewals(withinDays)
      if (renewals.length === 0) return `No renewals in the next ${withinDays} days.`
      return JSON.stringify(
        renewals.map(s => ({
          vendor: s.vendorName,
          plan: s.planName,
          cost: fmtAmount(s.cost),
          renewalDate: s.renewalDate.toISOString().split("T")[0],
          responsible: s.responsibleName ?? "Unassigned",
        }))
      )
    }

    if (toolName === "get_total_spend") {
      const vendorName = toolInput.vendor_name as string | undefined
      const result = await input.getTotalSpend(vendorName)
      const label = vendorName ? `${vendorName}` : "all vendors"
      return `Total spend recorded for ${label}: ${fmtAmount(result.total, result.currency)}`
    }

    return "Unknown tool."
  } catch {
    return "Error retrieving data. Please try again."
  }
}

// ─── Agent (non-streaming) ────────────────────────────────────────────────────

export async function runBillingAssistant(
  input: BillingAssistantInput
): Promise<BillingAssistantResult> {
  const messages = [...input.messages]

  while (true) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(input.context),
      tools,
      messages,
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      )
      return { text: textBlock?.text ?? "", messages }
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    if (toolUseBlocks.length === 0) break

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (tool) => ({
        type: "tool_result" as const,
        tool_use_id: tool.id,
        content: await executeTool(tool.name, tool.input as Record<string, unknown>, input),
      }))
    )

    messages.push({ role: "user", content: toolResults })
  }

  return { text: "", messages }
}

// ─── Agent (streaming) ────────────────────────────────────────────────────────

export async function streamBillingAssistant(
  input: BillingAssistantInput,
  onText: (delta: string) => void,
  onDone: (result: BillingAssistantResult) => void
): Promise<void> {
  const messages = [...input.messages]

  while (true) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(input.context),
      tools,
      messages,
    })

    stream.on("text", (delta) => onText(delta))

    const message = await stream.finalMessage()
    messages.push({ role: "assistant", content: message.content })

    if (message.stop_reason === "end_turn") {
      const textBlock = message.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      )
      onDone({ text: textBlock?.text ?? "", messages })
      return
    }

    const toolUseBlocks = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    )
    if (toolUseBlocks.length === 0) break

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (tool) => ({
        type: "tool_result" as const,
        tool_use_id: tool.id,
        content: await executeTool(tool.name, tool.input as Record<string, unknown>, input),
      }))
    )

    messages.push({ role: "user", content: toolResults })
  }
}
