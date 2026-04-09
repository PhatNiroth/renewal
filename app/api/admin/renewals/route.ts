import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const subs = await db.subscription.findMany({
    where: { status: { in: ["ACTIVE", "EXPIRING_SOON", "EXPIRED"] } },
    include: { vendor: true, responsible: true },
    orderBy: { renewalDate: "asc" },
  })
  return NextResponse.json(subs)
}
