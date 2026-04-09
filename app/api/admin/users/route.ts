import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { role: true, _count: { select: { responsibleFor: true } } },
  })
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { name, email, password, roleId, isAdmin } = await req.json()
  if (!email?.trim() || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })

  const existing = await db.user.findUnique({ where: { email: email.trim() } })
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 })

  const hashed = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      name:     name?.trim() || null,
      email:    email.trim(),
      password: hashed,
      isAdmin:  isAdmin ?? false,
      roleId:   roleId || null,
    },
    include: { role: true },
  })
  return NextResponse.json(user, { status: 201 })
}
