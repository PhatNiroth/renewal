import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { Permissions } from "@/lib/auth"

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!(session.user as any).isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { session }
}

export function getPermissions(session: any): Permissions {
  return (session?.user as any)?.permissions ?? {}
}

export function can(permissions: Permissions, module: string, action: "view" | "add" | "edit" | "delete"): boolean {
  return permissions?.[module]?.[action] === true
}
