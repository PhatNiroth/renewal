import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getPermissions, can } from "@/lib/permissions"
import { NextResponse } from "next/server"

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const u = session.user as { isAdmin?: boolean }
  const perms = getPermissions(session)
  if (!u.isAdmin && !can(perms, "VENDOR_CATEGORIES", "view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const categories = await db.vendorCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { vendors: true } } },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const u = session.user as { isAdmin?: boolean }
  const perms = getPermissions(session)
  if (!u.isAdmin && !can(perms, "VENDOR_CATEGORIES", "add")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, color } = body
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const slug = toSlug(name.trim())

  try {
    const category = await db.vendorCategory.create({
      data: { name: name.trim(), slug, color: color || "gray" },
      include: { _count: { select: { vendors: true } } },
    })
    return NextResponse.json(category, { status: 201 })
  } catch {
    return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 })
  }
}
