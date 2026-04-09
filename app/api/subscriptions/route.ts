import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const subscriptions = await db.subscription.findMany({
    include: { vendor: true, responsible: true },
    orderBy: { renewalDate: "asc" },
  })

  return NextResponse.json(subscriptions)
}
