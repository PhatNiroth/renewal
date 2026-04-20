import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getPermissions, can } from "@/lib/permissions"
import { NextResponse } from "next/server"

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const u = session.user as { isAdmin?: boolean }
  const perms = getPermissions(session)
  if (!u.isAdmin && !can(perms, "VENDOR_CATEGORIES", "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { name, color } = body

  try {
    const category = await db.vendorCategory.update({
      where: { id },
      data: {
        name:  name?.trim()  ?? undefined,
        slug:  name?.trim()  ? toSlug(name.trim()) : undefined,
        color: color         ?? undefined,
      },
      include: { _count: { select: { vendors: true } } },
    })
    return NextResponse.json(category)
  } catch {
    return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const u = session.user as { isAdmin?: boolean }
  const perms = getPermissions(session)
  if (!u.isAdmin && !can(perms, "VENDOR_CATEGORIES", "delete")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const count = await db.vendor.count({ where: { categoryId: id } })
  if (count > 0) return NextResponse.json({ error: `Cannot delete — ${count} vendor${count !== 1 ? "s" : ""} use this category` }, { status: 400 })

  await db.vendorCategory.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
