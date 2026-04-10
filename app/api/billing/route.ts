import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const payments = await db.payment.findMany({
    where: {
      subscription: { responsibleId: session.user.id },
    },
    include: {
      subscription: {
        select: {
          id: true,
          planName: true,
          vendor: { select: { id: true, name: true } },
        },
      },
      paidBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { paidAt: "desc" },
  })

  return NextResponse.json(payments)
}
