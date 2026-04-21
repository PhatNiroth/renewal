import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { BillingCycle, SubscriptionStatus } from "@prisma/client"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const subs = await db.subscription.findMany({
    include: { vendor: true, responsible: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(subs)
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { vendorId, planName, cost, billingCycle, startDate, renewalDate, status, responsibleId, notes, autoRenew } = body

  if (!vendorId || !planName || cost === undefined || !startDate || !renewalDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const sub = await db.subscription.create({
    data: {
      vendorId,
      planName:      planName.trim(),
      cost:          Number(cost),
      billingCycle:  billingCycle as BillingCycle ?? BillingCycle.MONTHLY,
      startDate:     new Date(startDate),
      renewalDate:   new Date(renewalDate),
      status:        status as SubscriptionStatus ?? SubscriptionStatus.ACTIVE,
      responsibleId: responsibleId || null,
      notes:         notes?.trim() || null,
      autoRenew:     Boolean(autoRenew),
    },
    include: { vendor: true, responsible: true },
  })
  return NextResponse.json(sub, { status: 201 })
}
