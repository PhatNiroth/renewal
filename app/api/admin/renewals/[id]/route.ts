import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { SubscriptionStatus } from "@prisma/client"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { action, renewalDate } = await req.json()

  const sub = await db.subscription.findUnique({ where: { id } })
  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 })

  if (action === "mark_renewed") {
    const today   = new Date()
    const current = sub.renewalDate.getTime() > today.getTime() ? new Date(sub.renewalDate) : today
    const next    = new Date(current)
    if      (sub.billingCycle === "MONTHLY")   next.setMonth(current.getMonth() + 1)
    else if (sub.billingCycle === "QUARTERLY") next.setMonth(current.getMonth() + 3)
    else if (sub.billingCycle === "SEMESTER")  next.setMonth(current.getMonth() + 6)
    else if (sub.billingCycle === "YEARLY")    next.setFullYear(current.getFullYear() + 1)
    else if (sub.billingCycle === "CUSTOM")    next.setDate(current.getDate() + (sub.customDays ?? 30))
    else                                       next.setFullYear(current.getFullYear() + 1)

    const updated = await db.subscription.update({
      where: { id },
      data: { renewalDate: next, status: SubscriptionStatus.ACTIVE },
      include: { vendor: true, responsible: true },
    })
    return NextResponse.json(updated)
  }

  if (action === "cancel") {
    const updated = await db.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.CANCELLED },
      include: { vendor: true, responsible: true },
    })
    return NextResponse.json(updated)
  }

  if (action === "update_date" && renewalDate) {
    const updated = await db.subscription.update({
      where: { id },
      data: { renewalDate: new Date(renewalDate) },
      include: { vendor: true, responsible: true },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
