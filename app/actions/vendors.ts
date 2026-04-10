"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

type ActionResult = { error: string } | { success: true }

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function normalizeUrl(url: string | null): string | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  return `https://${trimmed}`
}

function canManageVendors(session: Awaited<ReturnType<typeof auth>>) {
  if (!session?.user) return false
  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { add?: boolean; edit?: boolean }> }
  return u.isAdmin === true || u.permissions?.VENDORS?.edit === true || u.permissions?.VENDORS?.add === true
}

export async function createVendor(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!canManageVendors(session)) return { error: "Unauthorized" }

  const name         = formData.get("name") as string
  const categoryId   = formData.get("categoryId") as string | null
  const website      = formData.get("website") as string | null
  const contactEmail = formData.get("contactEmail") as string | null
  const contactName  = formData.get("contactName") as string | null
  const notes         = formData.get("notes") as string | null
  const paymentMethod = formData.get("paymentMethod") as string | null

  if (!name) return { error: "Vendor name is required" }

  const slug = toSlug(name)

  try {
    await db.vendor.create({
      data: {
        name,
        slug,
        categoryId:    categoryId || null,
        website:       normalizeUrl(website),
        contactEmail:  contactEmail  || null,
        contactName:   contactName   || null,
        notes:         notes         || null,
        paymentMethod: paymentMethod || null,
      },
    })
    revalidatePath("/dashboard/vendors")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("Unique constraint")) return { error: "A vendor with this name already exists" }
    return { error: message }
  }
}

export async function updateVendor(vendorId: string, formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!canManageVendors(session)) return { error: "Unauthorized" }

  const name         = formData.get("name") as string
  const categoryId   = formData.get("categoryId") as string | null
  const website      = formData.get("website") as string | null
  const contactEmail = formData.get("contactEmail") as string | null
  const contactName  = formData.get("contactName") as string | null
  const notes         = formData.get("notes") as string | null
  const paymentMethod = formData.get("paymentMethod") as string | null

  try {
    await db.vendor.update({
      where: { id: vendorId },
      data: {
        name,
        slug:          toSlug(name),
        categoryId:    categoryId || null,
        website:       normalizeUrl(website),
        contactEmail:  contactEmail  || null,
        contactName:   contactName   || null,
        notes:         notes         || null,
        paymentMethod: paymentMethod || null,
      },
    })
    revalidatePath("/dashboard/vendors")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

export async function deactivateVendor(vendorId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const u = session.user as { isAdmin?: boolean }
  if (!u.isAdmin) return { error: "Forbidden — Admin only" }

  try {
    await db.vendor.update({ where: { id: vendorId }, data: { isActive: false } })
    revalidatePath("/dashboard/vendors")
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
