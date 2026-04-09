import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const payments = await db.payment.findMany({
    include: {
      subscription: { include: { vendor: true } },
      paidBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { paidAt: "desc" },
  })

  return NextResponse.json(payments)
}
