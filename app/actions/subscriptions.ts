"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { BillingCycle, Department, SubscriptionStatus } from "@prisma/client"
import { nextRenewalDate } from "@/lib/renewal-utils"

type ActionResult = { error: string } | { success: true }

function getUser(session: Awaited<ReturnType<typeof auth>>) {
  return session?.user as { isAdmin?: boolean; permissions?: Record<string, { add?: boolean; edit?: boolean; delete?: boolean }> } | undefined
}

export async function createSubscription(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.SUBSCRIPTIONS?.add) return { error: "Forbidden" }

  const vendorId      = formData.get("vendorId") as string
  const planName      = formData.get("planName") as string
  const departmentRaw = formData.get("department") as string | null
  const department    = (departmentRaw && departmentRaw in Department) ? departmentRaw as Department : null
  const cost          = formData.get("cost") as string
  const billingCycle  = (formData.get("billingCycle") as BillingCycle) || "MONTHLY"
  const customDays    = formData.get("customDays") as string | null
  const startDate     = formData.get("startDate") as string
  const renewalDate   = formData.get("renewalDate") as string
  const responsibleId = formData.get("responsibleId") as string | null
  const notes         = formData.get("notes") as string | null
  const documentPath  = formData.get("documentPath") as string | null

  if (!vendorId)    return { error: "Vendor is required" }
  if (!planName)    return { error: "Plan / service name is required" }
  if (!cost)        return { error: "Cost is required" }
  if (!startDate)   return { error: "Start date is required" }
  if (!renewalDate) return { error: "Renewal date is required" }
  if (billingCycle === "CUSTOM" && !customDays) return { error: "Custom duration (days) is required" }

  const costCents = Math.round(parseFloat(cost) * 100)
  if (isNaN(costCents) || costCents < 0) return { error: "Invalid cost amount" }

  try {
    await db.subscription.create({
      data: {
        vendorId,
        planName,
        department:    department || null,
        cost:          costCents,
        billingCycle,
        customDays:    billingCycle === "CUSTOM" && customDays ? parseInt(customDays) : null,
        startDate:     new Date(startDate),
        renewalDate:   new Date(renewalDate),
        status:        SubscriptionStatus.ACTIVE,
        responsibleId: responsibleId || null,
        notes:         notes || null,
        documentPath:  documentPath || null,
      },
    })
    revalidatePath("/dashboard/subscriptions")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function updateSubscription(
  subscriptionId: string,
  data: Partial<{
    planName: string
    department: Department | null
    cost: number
    billingCycle: BillingCycle
    customDays: number | null
    renewalDate: Date
    status: SubscriptionStatus
    responsibleId: string | null
    notes: string | null
    documentPath: string | null
  }>
): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.SUBSCRIPTIONS?.edit) return { error: "Forbidden" }

  try {
    await db.subscription.update({ where: { id: subscriptionId }, data })
    revalidatePath("/dashboard/subscriptions")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.SUBSCRIPTIONS?.edit) return { error: "Forbidden" }

  try {
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED },
    })
    revalidatePath("/dashboard/subscriptions")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function markAsRenewed(subscriptionId: string): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.RENEWALS?.edit) return { error: "Forbidden" }

  try {
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId } })
    if (!sub) return { error: "Subscription not found" }

    const next = nextRenewalDate(sub.renewalDate, sub.billingCycle, sub.customDays)

    await db.subscription.update({
      where: { id: subscriptionId },
      data: {
        status:      SubscriptionStatus.ACTIVE,
        renewalDate: sub.billingCycle === BillingCycle.ONE_TIME ? sub.renewalDate : next,
      },
    })

    revalidatePath("/dashboard/renewals")
    revalidatePath("/dashboard/subscriptions")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function deleteSubscription(subscriptionId: string): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }
  if (!u.isAdmin && !u.permissions?.SUBSCRIPTIONS?.delete) return { error: "Forbidden" }

  try {
    await db.subscription.delete({ where: { id: subscriptionId } })
    revalidatePath("/dashboard/subscriptions")
    revalidatePath("/dashboard")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
