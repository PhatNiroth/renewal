import { jwtVerify, type JWTPayload } from "jose"
import { cookies } from "next/headers"

export type Session = {
  user: {
    id: string
    email: string
    name: string | null
    isAdmin: boolean
  }
}

type AccessTokenPayload = JWTPayload & {
  sub: string
  email: string
  firstName: string | null
  lastName: string | null
  groups: string[]
}

function getSecret() {
  // const secret = process.env.JWT_ACCESS_SECRET
  // if (!secret) throw new Error("JWT_ACCESS_SECRET is not set")
  // return new TextEncoder().encode(secret)
  return new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!)
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

    const secret = getSecret();
    const { payload } = await jwtVerify<AccessTokenPayload>(token, secret)
    return payloadToSession(payload)
  } catch (err) {
    console.error("Auth: jwtVerify failed:", err)
    return null
  }
}
