"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

type ActionResult = { error: string } | { success: true }

function getUser(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user as { id?: string; isAdmin?: boolean; permissions?: Record<string, { add?: boolean; delete?: boolean }> } | undefined
}

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.PAYMENTS?.add) return { error: "Forbidden" }

  const subscriptionId = formData.get("subscriptionId") as string
  const amount         = formData.get("amount") as string
  const paidAt         = formData.get("paidAt") as string
  const note           = formData.get("note") as string | null
  const receiptUrl     = formData.get("receiptUrl") as string | null

  if (!subscriptionId) return { error: "Subscription is required" }
  if (!amount)         return { error: "Amount is required" }
  if (!paidAt)         return { error: "Payment date is required" }

  const amountCents = Math.round(parseFloat(amount) * 100)
  if (isNaN(amountCents) || amountCents <= 0) return { error: "Invalid amount" }

  try {
    await db.payment.create({
      data: {
        subscriptionId,
        amount: amountCents,
        paidAt:    new Date(paidAt),
        paidById:  u.id ?? null,
        note:      note || null,
        receiptUrl: receiptUrl || null,
      },
    })
    revalidatePath("/dashboard/billing")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.PAYMENTS?.delete) return { error: "Forbidden" }

  try {
    await db.payment.delete({ where: { id: paymentId } })
    revalidatePath("/dashboard/billing")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
