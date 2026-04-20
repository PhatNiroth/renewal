import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // Protect with a secret so only your server/cron can trigger this
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET is not configured")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const authHeader = req.headers.get("authorization")
  const expected   = `Bearer ${cronSecret}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Dynamic import to avoid Resend client instantiation at build time
    const { runNotificationDispatcher } = await import("@/lib/notification-dispatcher")
    const result = await runNotificationDispatcher()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[cron/notifications] Unhandled error:", err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
