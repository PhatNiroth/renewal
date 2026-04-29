import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { name, isAdmin } = await req.json()

  const user = await db.user.update({
    where: { id },
    data: {
      name:    name?.trim() ?? undefined,
      isAdmin: isAdmin !== undefined ? isAdmin : undefined,
    },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const { id } = await params
  if (id === (session!.user as any).id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
  }

  await db.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
