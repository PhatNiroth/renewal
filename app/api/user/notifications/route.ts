import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const pref = await db.notificationPref.findUnique({
    where: { userId: session.user.id },
  })

  // Return defaults if no record yet
  return NextResponse.json({
    renewal7d:      pref?.renewal7d      ?? true,
    renewal3d:      pref?.renewal3d      ?? true,
    renewal1d:      pref?.renewal1d      ?? true,
    renewalExpired: pref?.renewalExpired ?? false,
    telegramChatId: pref?.telegramChatId ?? null,
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { renewal7d, renewal3d, renewal1d, renewalExpired, telegramChatId } = body

  const pref = await db.notificationPref.upsert({
    where:  { userId: session.user.id },
    create: {
      userId: session.user.id,
      renewal7d:      renewal7d      ?? true,
      renewal3d:      renewal3d      ?? true,
      renewal1d:      renewal1d      ?? true,
      renewalExpired: renewalExpired ?? false,
      telegramChatId: telegramChatId ?? null,
    },
    update: {
      renewal7d:      renewal7d      ?? undefined,
      renewal3d:      renewal3d      ?? undefined,
      renewal1d:      renewal1d      ?? undefined,
      renewalExpired: renewalExpired ?? undefined,
      telegramChatId: telegramChatId !== undefined ? (telegramChatId || null) : undefined,
    },
  })

  return NextResponse.json(pref)
}
