import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const vendors = await db.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      category: true,
      _count: { select: { subscriptions: true } },
    },
  })
  return NextResponse.json(vendors)
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const { name, categoryId, website, contactEmail, contactName, contactPhone, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const slug = toSlug(name.trim())
  try {
    const vendor = await db.vendor.create({
      data: {
        name:         name.trim(),
        slug,
        categoryId:   categoryId || null,
        website:      website?.trim()      || null,
        contactEmail: contactEmail?.trim() || null,
        contactName:  contactName?.trim()  || null,
        contactPhone: contactPhone?.trim() || null,
        notes:        notes?.trim()        || null,
      },
      include: { category: true, _count: { select: { subscriptions: true } } },
    })
    return NextResponse.json(vendor, { status: 201 })
  } catch (err) {
    console.error("POST /api/admin/vendors failed:", err)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A vendor with this name already exists" }, { status: 409 })
    }
    if (message.includes("Foreign key constraint")) {
      return NextResponse.json({ error: "Invalid category selected" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 })
  }
}
