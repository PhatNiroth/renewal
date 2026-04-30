import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const sub = await db.subscription.findUnique({ where: { id }, select: { id: true } })
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const logs = await db.renewalLog.findMany({
    where: { subscriptionId: id },
    include: { renewedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })

  const serialized = logs.map(log => ({
    id: log.id,
    previousDate: log.previousDate.toISOString(),
    newDate: log.newDate.toISOString(),
    createdAt: log.createdAt.toISOString(),
    renewedBy: { name: log.renewedBy.name, email: log.renewedBy.email },
    isAuto: log.notes === "auto",
  }))

  return NextResponse.json(serialized)
}
