import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { Module } from "@prisma/client"

const ALL_MODULES = [Module.SUBSCRIPTIONS, Module.RENEWALS, Module.VENDORS, Module.PAYMENTS]

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { name, permissions } = await req.json()

  const existing = await db.role.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 })

  const role = await db.role.update({
    where: { id },
    data: {
      name: name?.trim() ?? existing.name,
      permissions: permissions
        ? {
            deleteMany: {},
            create: ALL_MODULES.map(module => ({
              module,
              canView:   permissions[module]?.view   ?? false,
              canAdd:    permissions[module]?.add    ?? false,
              canEdit:   permissions[module]?.edit   ?? false,
              canDelete: permissions[module]?.delete ?? false,
            })),
          }
        : undefined,
    },
    include: { permissions: true },
  })
  return NextResponse.json(role)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const role = await db.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

  if (role._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${role._count.users} user${role._count.users > 1 ? "s are" : " is"} assigned to this role. Reassign them first.` },
      { status: 400 }
    )
  }

  await db.role.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
