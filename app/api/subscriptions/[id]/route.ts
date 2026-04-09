import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const sub = await db.subscription.findUnique({
    where: { id },
    include: { vendor: true, responsible: true },
  })
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(sub)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  await db.subscription.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
