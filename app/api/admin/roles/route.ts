import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { Module } from "@prisma/client"

const ALL_MODULES = [Module.SUBSCRIPTIONS, Module.RENEWALS, Module.VENDORS, Module.VENDOR_CATEGORIES, Module.PAYMENTS]

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const roles = await db.role.findMany({
    include: { permissions: true, _count: { select: { users: true } } },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(roles)
}

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { name, permissions } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const role = await db.role.create({
    data: {
      name: name.trim(),
      permissions: {
        create: ALL_MODULES.map(module => ({
          module,
          canView:   permissions?.[module]?.view   ?? false,
          canAdd:    permissions?.[module]?.add    ?? false,
          canEdit:   permissions?.[module]?.edit   ?? false,
          canDelete: permissions?.[module]?.delete ?? false,
        })),
      },
    },
    include: { permissions: true },
  })
  return NextResponse.json(role, { status: 201 })
}
