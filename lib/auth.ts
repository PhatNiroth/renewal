import { jwtVerify } from "jose"
import { cookies } from "next/headers"

export type Session = {
  user: {
    id: string
    email: string
    name: string | null
    isAdmin: boolean
  }
}

type AccessTokenPayload = {
  sub: string
  email: string
  firstName: string | null
  lastName: string | null
  groups: string[]
}

function getSecret() {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set")
  return new TextEncoder().encode(secret)
}

function payloadToSession(payload: AccessTokenPayload): Session {
  const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ") || null
  return {
    user: {
      id:      payload.sub,
      email:   payload.email,
      name,
      isAdmin: payload.groups.includes("admin"),
    },
  }
}

export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("access_token")?.value
    if (!token) return null

    const { payload } = await jwtVerify<AccessTokenPayload>(token, getSecret())
    return payloadToSession(payload)
  } catch {
    return null
  }
}

// declare module augmentation so existing code that uses session.user.isAdmin still works
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      isAdmin: boolean
      roleName?: string | null
      permissions: Record<string, unknown>
    }
  }
}
