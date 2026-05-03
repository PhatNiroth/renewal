import { jwtVerify } from "jose"
import { NextRequest, NextResponse } from "next/server"

type AccessTokenPayload = {
  sub: string
  groups: string[]
}

async function getSession(req: NextRequest): Promise<{ id: string; isAdmin: boolean } | null> {
  try {
    const token = req.cookies.get("access_token")?.value
    if (!token) return null

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = await getSession(req)
  const isLoggedIn = !!session

  console.log(`Middleware: ${pathname}, logged in: ${isLoggedIn}, isAdmin: ${session?.isAdmin}`)

  if (pathname.startsWith("/renewal/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("http://localhost:3000/login", req.url))
    }

    if (
      pathname.startsWith("/renewal/dashboard/settings") &&
      !session?.isAdmin
    ) {
      return NextResponse.redirect(new URL("/renewal/dashboard", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/renewal/dashboard/:path*"],
}
