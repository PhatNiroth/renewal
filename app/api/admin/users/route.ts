import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, isAdmin: true, createdAt: true, _count: { select: { responsibleFor: true } } },
  })
  return NextResponse.json(users)
}
