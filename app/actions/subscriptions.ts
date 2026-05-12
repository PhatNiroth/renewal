"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { updateTag } from "next/cache"
import { CacheTags } from "@/lib/cache-tags"
import { BillingCycle, Department, SubscriptionStatus, SubscriptionKind } from "@prisma/client"
import { nextRenewalDate } from "@/lib/renewal-utils"

const VALID_KINDS = ["SUBSCRIPTION", "MEMBERSHIP", "CARD", "CONTRACT", "LEASE", "LICENSE", "INSURANCE", "DOMAIN", "PERMIT", "OTHER"] as const
function parseKind(raw: string | null): SubscriptionKind {
  return raw && (VALID_KINDS as readonly string[]).includes(raw)
    ? (raw as SubscriptionKind)
    : ("SUBSCRIPTION" as SubscriptionKind)
}

type ActionResult = { error: string } | { success: true }

type SessionUser = { id?: string; isAdmin?: boolean }

function getUser(session: { user?: SessionUser } | null): SessionUser | undefined {
  return session?.user as SessionUser | undefined
}

const ALLOWED_EXTRA_REMINDERS = [90, 30, 14] as const

function parseExtraReminders(values: (FormDataEntryValue | string | number)[]): number[] {
  const seen = new Set<number>()
  for (const v of values) {
    const n = typeof v === "number" ? v : parseInt(String(v))
    if (Number.isFinite(n) && (ALLOWED_EXTRA_REMINDERS as readonly number[]).includes(n)) seen.add(n)
  }
  return [...seen]
}

async function syncExtraReminders(subscriptionId: string, daysList: number[]) {
  await db.notificationConfig.deleteMany({
    where: { subscriptionId, daysBefore: { in: ALLOWED_EXTRA_REMINDERS as unknown as number[] } },
  })
  if (daysList.length > 0) {
    await db.notificationConfig.createMany({
      data: daysList.map(daysBefore => ({ subscriptionId, daysBefore })),
    })
  }
}

export async function createSubscription(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }

  const vendorId        = formData.get("vendorId") as string
  const planName        = formData.get("planName") as string
  const kind            = parseKind(formData.get("kind") as string | null)
  const departmentRaw   = formData.get("department") as string | null
  const department      = (departmentRaw && departmentRaw in Department) ? departmentRaw as Department : null
  const cost            = formData.get("cost") as string
  const billingCycle    = (formData.get("billingCycle") as BillingCycle) || "MONTHLY"
  const customDays      = formData.get("customDays") as string | null
  const startDate       = formData.get("startDate") as string
  const renewalDate     = formData.get("renewalDate") as string
  const responsibleId   = formData.get("responsibleId") as string | null
  const notes           = formData.get("notes") as string | null
  const documentPath    = formData.get("documentPath") as string | null
  const autoRenew       = formData.get("autoRenew") === "on" || formData.get("autoRenew") === "true"
  const cardBrandRaw    = formData.get("cardBrand") as string | null
  const cardLast4Raw    = formData.get("cardLast4") as string | null
  const cardBrand       = kind === "CARD" && cardBrandRaw?.trim() ? cardBrandRaw.trim().slice(0, 50) : null
  const cardLast4       = kind === "CARD" && cardLast4Raw?.trim() ? cardLast4Raw.trim() : null

  if (cardLast4 && !/^\d{4}$/.test(cardLast4)) return { error: "Card last 4 must be exactly 4 digits" }

  if (!vendorId)    return { error: "Vendor is required" }
  if (!planName)    return { error: "Plan / service name is required" }
  if (!startDate)   return { error: "Start date is required" }
  if (!renewalDate) return { error: "Renewal date is required" }
  if (new Date(renewalDate) <= new Date(startDate)) return { error: "Renewal date must be after start date" }
  if (billingCycle === "CUSTOM" && !customDays) return { error: "Custom duration (days) is required" }

  const costCents = cost ? Math.round(parseFloat(cost) * 100) : 0
  if (isNaN(costCents) || costCents < 0) return { error: "Invalid cost amount" }

  const duplicate = await db.subscription.findFirst({
    where: {
      vendorId,
      planName: { equals: planName, mode: "insensitive" },
      status:   { not: SubscriptionStatus.CANCELLED },
    },
    select: { id: true },
  })
  if (duplicate) return { error: `A subscription "${planName}" for this vendor already exists` }

  const extraReminders = parseExtraReminders(formData.getAll("extraReminders"))

  try {
    const created = await db.subscription.create({
      data: {
        vendorId,
        planName,
        kind,
        department:      department || null,
        cost:            costCents,
        billingCycle,
        customDays:      billingCycle === "CUSTOM" && customDays ? parseInt(customDays) : null,
        startDate:       new Date(startDate),
        renewalDate:     new Date(renewalDate),
        status:          SubscriptionStatus.ACTIVE,
        responsibleId:   responsibleId   || null,
        notes:           notes           || null,
        documentPath:    documentPath    || null,
        autoRenew,
        cardBrand,
        cardLast4,
      },
    })
    if (extraReminders.length > 0) await syncExtraReminders(created.id, extraReminders)
    updateTag(CacheTags.subscriptions)
    updateTag(CacheTags.vendors)
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
    kind: SubscriptionKind
    department: Department | null
    cost: number
    billingCycle: BillingCycle
    customDays: number | null
    startDate: Date
    renewalDate: Date
    status: SubscriptionStatus
    responsibleId: string | null
    notes: string | null
    documentPath: string | null
    autoRenew: boolean
    cardBrand: string | null
    cardLast4: string | null
    extraReminders: number[]
  }>
): Promise<ActionResult> {
  const session = await auth()
  const u = getUser(session)
  if (!u) return { error: "Unauthorized" }

  if (data.startDate && data.renewalDate && data.renewalDate <= data.startDate) {
    return { error: "Renewal date must be after start date" }
  }
  if (data.cardLast4 && !/^\d{4}$/.test(data.cardLast4)) {
    return { error: "Card last 4 must be exactly 4 digits" }
  }

  const { extraReminders, ...rest } = data

  try {
    await db.subscription.update({ where: { id: subscriptionId }, data: rest })
    if (extraReminders !== undefined) {
      await syncExtraReminders(subscriptionId, parseExtraReminders(extraReminders))
    }
    updateTag(CacheTags.subscriptions)
    updateTag(CacheTags.vendors)
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

  try {
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED },
    })
    updateTag(CacheTags.subscriptions)
    updateTag(CacheTags.vendors)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function markAsRenewed(subscriptionId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  const { id: userId, email, name } = session.user

  try {
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId } })
    if (!sub) return { error: "Subscription not found" }

    const next    = nextRenewalDate(sub.renewalDate, sub.billingCycle, sub.customDays)
    const newDate = sub.billingCycle === BillingCycle.ONE_TIME ? sub.renewalDate : next

    await db.$transaction(async (tx) => {
      const dbUser = await tx.user.upsert({
        where:  { email },
        update: { name: name ?? null },
        create: { email, name: name ?? null },
        select: { id: true },
      })

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status:      SubscriptionStatus.ACTIVE,
          renewalDate: newDate,
        },
      })

      await tx.renewalLog.create({
        data: {
          subscriptionId,
          previousDate: sub.renewalDate,
          newDate,
          renewedById:  dbUser.id,
        },
      })
    })

    updateTag(CacheTags.subscriptions)
    updateTag(CacheTags.vendors)
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

  try {
    await db.subscription.delete({ where: { id: subscriptionId } })
    updateTag(CacheTags.subscriptions)
    updateTag(CacheTags.vendors)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
