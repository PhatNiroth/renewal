"use server"

import { signOut } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

type ActionResult = { error: string } | { success: true }

export async function signup(formData: FormData): Promise<ActionResult> {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" }
  }

  try {
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return { error: "An account with this email already exists" }
    }

    const hashed = await bcrypt.hash(password, 12)
    await db.user.create({
      data: { name: name || null, email, password: hashed },
    })

    return { success: true }
  } catch (err) {
    console.error("Signup error:", err)
    // TODO: remove specific error in production
    const message = err instanceof Error ? err.message : String(err)
    return { error: `[DEBUG] ${message}` }
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
  revalidatePath("/")
}
