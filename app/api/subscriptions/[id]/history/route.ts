import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getPermissions, can } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const u = session.user as { isAdmin?: boolean }
  const perms = getPermissions(session)
  if (!u.isAdmin && !can(perms, "RENEWALS", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
  }))

  return NextResponse.json(serialized)
}
