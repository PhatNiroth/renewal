import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import VendorsClient from "./vendors-client"

export default async function VendorsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean; add?: boolean; edit?: boolean; delete?: boolean }> }
  if (!u.isAdmin && !u.permissions?.VENDORS?.view) redirect("/dashboard")

  const canAdd             = u.isAdmin || u.permissions?.VENDORS?.add             === true
  const canEdit            = u.isAdmin || u.permissions?.VENDORS?.edit            === true
  const canDelete          = u.isAdmin || u.permissions?.VENDORS?.delete          === true
  const canCreateCategory  = u.isAdmin || u.permissions?.VENDOR_CATEGORIES?.add   === true

  const [vendors, categories] = await Promise.all([
    db.vendor.findMany({
      include: { category: true, _count: { select: { subscriptions: true } } },
      orderBy: { name: "asc" },
    }),
    db.vendorCategory.findMany({ orderBy: { name: "asc" } }),
  ])

  return (
    <VendorsClient
      vendors={vendors}
      categories={categories}
      canAdd={!!canAdd}
      canEdit={!!canEdit}
      canDelete={!!canDelete}
      canCreateCategory={!!canCreateCategory}
    />
  )
}
