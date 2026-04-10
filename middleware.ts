import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Use edge-safe config (no Prisma) for middleware
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/login", req.url))
    }
    if (
      pathname.startsWith("/dashboard/admin") &&
      !(req.auth?.user as any)?.isAdmin
    ) {
      return Response.redirect(new URL("/dashboard", req.url))
    }
  }

  if (pathname === "/login" && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.url))
  }
})

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
}
