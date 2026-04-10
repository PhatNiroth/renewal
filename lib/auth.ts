import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { authConfig } from "@/auth.config"

export type ModulePerms = { view: boolean; add: boolean; edit: boolean; delete: boolean }
export type Permissions = Record<string, ModulePerms>

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      isAdmin: boolean
      roleName?: string | null
      permissions: Permissions
    }
  }
  interface User {
    isAdmin: boolean
    roleName?: string | null
    permissions: Permissions
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const normalizedEmail = (credentials.email as string).toLowerCase().trim()
        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
          include: {
            role: {
              include: { permissions: true },
            },
          },
        })

        if (!user?.password) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null

        // Build permissions map from role
        const permissions: Permissions = {}
        if (user.role?.permissions) {
          for (const p of user.role.permissions) {
            permissions[p.module] = {
              view:   p.canView,
              add:    p.canAdd,
              edit:   p.canEdit,
              delete: p.canDelete,
            }
          }
        }

        return {
          id:          user.id,
          email:       user.email,
          name:        user.name,
          isAdmin:     user.isAdmin,
          roleName:    user.role?.name ?? null,
          permissions,
        }
      },
    }),
  ],
})
