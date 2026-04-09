import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await req.json()

  const vendor = await db.vendor.update({
    where: { id },
    data: {
      name:         body.name?.trim()         ?? undefined,
      categoryId:   body.categoryId !== undefined ? (body.categoryId || null) : undefined,
      website:      body.website      !== undefined ? (body.website?.trim()      || null) : undefined,
      contactEmail: body.contactEmail !== undefined ? (body.contactEmail?.trim() || null) : undefined,
      contactName:  body.contactName  !== undefined ? (body.contactName?.trim()  || null) : undefined,
      notes:        body.notes        !== undefined ? (body.notes?.trim()        || null) : undefined,
      isActive:     body.isActive     !== undefined ? body.isActive : undefined,
    },
    include: { category: true, _count: { select: { subscriptions: true } } },
  })
  return NextResponse.json(vendor)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const count = await db.subscription.count({ where: { vendorId: id } })
  if (count > 0) return NextResponse.json({ error: "Cannot delete vendor with active subscriptions" }, { status: 400 })

  await db.vendor.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
