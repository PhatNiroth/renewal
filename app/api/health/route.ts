import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const userCount = await db.user.count()
    return NextResponse.json({
      status: "ok",
      database: "connected",
      users: userCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { status: "error", database: "failed", error: message },
      { status: 500 }
    )
  }
}
