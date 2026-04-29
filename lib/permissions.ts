import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!(session.user as any).isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session }
}
