import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { pickAutoColor } from "@/lib/category-colors"
import { NextResponse } from "next/server"

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const categories = await db.vendorCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { vendors: true } } },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, color } = body
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const trimmed = name.trim()
  const slug = toSlug(trimmed)

  // Idempotent inline create: if a category with this name (case-insensitive)
  // or slug already exists, return it instead of erroring.
  const existing = await db.vendorCategory.findFirst({
    where: { OR: [{ slug }, { name: { equals: trimmed, mode: "insensitive" } }] },
    include: { _count: { select: { vendors: true } } },
  })
  if (existing) return NextResponse.json(existing)

  const finalColor = color || pickAutoColor(await db.vendorCategory.count())

  try {
    const category = await db.vendorCategory.create({
      data: { name: trimmed, slug, color: finalColor },
      include: { _count: { select: { vendors: true } } },
    })
    return NextResponse.json(category, { status: 201 })
  } catch {
    return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 })
  }
}
