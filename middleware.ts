import { jwtVerify } from "jose"
import { NextRequest, NextResponse } from "next/server"

type AccessTokenPayload = {
  sub: string
  groups: string[]
}

async function verifyToken(token: string): Promise<{ id: string; isAdmin: boolean } | null> {
  try {
    const secret = process.env.JWT_ACCESS_SECRET
    if (!secret) return null

    const { payload } = await jwtVerify<AccessTokenPayload>(
      token,
      new TextEncoder().encode(secret)
    )

    return {
      id:      payload.sub,
      isAdmin: payload.groups.includes("admin"),
    }
  } catch {
    return null
  }
}

async function tryRefresh(req: NextRequest): Promise<{ session: { id: string; isAdmin: boolean }; newAccessToken: string } | null> {
  const refreshToken = req.cookies.get("refresh_token")?.value
  if (!refreshToken) return null

  try {
    const dashboardUrl = process.env.DASHBOARD_URL ?? "https://dashboard.krawma.com"
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${dashboardUrl}/api/auth/refresh`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", cookie: `refresh_token=${refreshToken}` },
      signal:  controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    const newAccessToken: string = data.access_token
    if (!newAccessToken) return null

    const session = await verifyToken(newAccessToken)
    if (!session) return null

    return { session, newAccessToken }
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Try existing access token first
  const accessToken = req.cookies.get("access_token")?.value
  let session = accessToken ? await verifyToken(accessToken) : null
  let newAccessToken: string | null = null

  // If access token is missing or expired, try refresh
  if (!session) {
    const refreshed = await tryRefresh(req)
    if (refreshed) {
      session = refreshed.session
      newAccessToken = refreshed.newAccessToken
    }
  }

  const isLoggedIn = !!session
  console.log(`Middleware: ${pathname}, logged in: ${isLoggedIn}, isAdmin: ${session?.isAdmin}`)

  if (pathname.startsWith("/renewal/dashboard")) {
    if (!isLoggedIn) {
      const loginUrl = process.env.DASHBOARD_URL
        ? `${process.env.DASHBOARD_URL}/login`
        : "https://dashboard.krawma.com/login"
      return NextResponse.redirect(new URL(loginUrl, req.url))
    }

    if (pathname.startsWith("/renewal/dashboard/settings") && !session?.isAdmin) {
      return NextResponse.redirect(new URL("/renewal/dashboard", req.url))
    }
  }

  const response = NextResponse.next()

  // Set the new access token cookie if we refreshed
  if (newAccessToken) {
    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
    })
  }

  return response
}

export const config = {
  matcher: ["/renewal/dashboard/:path*"],
}
