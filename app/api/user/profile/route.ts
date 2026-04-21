import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, email } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const data: { name: string; email?: string } = { name: name.trim() }

  if (typeof email === "string") {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return NextResponse.json({ error: "Email is required" }, { status: 400 })
    if (!EMAIL_RE.test(normalized)) return NextResponse.json({ error: "Invalid email address" }, { status: 400 })

    if (normalized !== session.user.email?.toLowerCase()) {
      const existing = await db.user.findUnique({ where: { email: normalized }, select: { id: true } })
      if (existing && existing.id !== session.user.id) {
        return NextResponse.json({ error: "This email is already in use" }, { status: 409 })
      }
      data.email = normalized
    }
  }

  await db.user.update({
    where: { id: session.user.id },
    data,
  })

  return NextResponse.json({ success: true, email: data.email ?? session.user.email })
}
