import { NextRequest, NextResponse } from "next/server"
import { runNotificationDispatcher } from "@/lib/notification-dispatcher"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // Protect with a secret so only your server/cron can trigger this
  const authHeader = req.headers.get("authorization")
  const expected   = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runNotificationDispatcher()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[cron/notifications] Unhandled error:", err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
