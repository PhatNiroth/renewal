import type { NextAuthConfig } from "next-auth"

/**
 * Edge-safe auth config — no Prisma, no bcrypt.
 * Used by middleware (Edge Runtime).
 * The full config with DB lookups lives in lib/auth.ts.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  providers: [], // providers added in lib/auth.ts
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id          = user.id
        token.isAdmin     = (user as any).isAdmin
        token.roleName    = (user as any).roleName ?? null
        token.permissions = (user as any).permissions ?? {}
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id          = token.id as string
        ;(session.user as any).isAdmin      = token.isAdmin
        ;(session.user as any).roleName     = token.roleName
        ;(session.user as any).permissions  = token.permissions ?? {}
      }
      return session
    },
  },
} satisfies NextAuthConfig
