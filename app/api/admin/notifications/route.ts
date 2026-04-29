import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/permissions"
import { NextResponse } from "next/server"

const GLOBAL_ID = "global"

export async function GET() {
  const { error } = await requireAdmin() as { error?: Response; session?: unknown }
  if (error) return error

  const setting = await db.globalNotificationSetting.findUnique({ where: { id: GLOBAL_ID } })

  return NextResponse.json({
    renewal7d:      setting?.renewal7d      ?? true,
    renewal3d:      setting?.renewal3d      ?? true,
    renewal1d:      setting?.renewal1d      ?? true,
    renewalExpired: setting?.renewalExpired ?? false,
  })
}

export async function PATCH(req: Request) {
  const { error } = await requireAdmin() as { error?: Response; session?: unknown }
  if (error) return error

  const { renewal7d, renewal3d, renewal1d, renewalExpired } = await req.json()

  const setting = await db.globalNotificationSetting.upsert({
    where:  { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, renewal7d, renewal3d, renewal1d, renewalExpired },
    update: {
      renewal7d:      renewal7d      ?? undefined,
      renewal3d:      renewal3d      ?? undefined,
      renewal1d:      renewal1d      ?? undefined,
      renewalExpired: renewalExpired ?? undefined,
    },
  })

  return NextResponse.json(setting)
}
