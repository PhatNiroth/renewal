import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { BillingCycle, SubscriptionStatus } from "@prisma/client"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await req.json()

  const sub = await db.subscription.update({
    where: { id },
    data: {
      vendorId:      body.vendorId      ?? undefined,
      planName:      body.planName      ? body.planName.trim() : undefined,
      cost:          body.cost !== undefined ? Number(body.cost) : undefined,
      billingCycle:  body.billingCycle  as BillingCycle  ?? undefined,
      startDate:     body.startDate     ? new Date(body.startDate)   : undefined,
      renewalDate:   body.renewalDate   ? new Date(body.renewalDate) : undefined,
      status:        body.status        as SubscriptionStatus ?? undefined,
      responsibleId: body.responsibleId !== undefined ? (body.responsibleId || null) : undefined,
      notes:         body.notes         !== undefined ? (body.notes?.trim() || null) : undefined,
    },
    include: { vendor: true, responsible: true },
  })
  return NextResponse.json(sub)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await db.subscription.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
