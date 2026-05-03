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
    console.log(`Auth: token present: ${token}`)
    if (!token) return null

    const { payload } = await jwtVerify<AccessTokenPayload>(token, getSecret())
    console.log(`Auth: token valid, payload: ${JSON.stringify(payload)}`)
    return payloadToSession(payload)
  } catch {
    return null
  }
}

