import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import VendorsClient from "./vendors-client"

export const revalidate = 30

export default async function VendorsPage() {
  const session = await auth()
  const isAdmin = session?.user?.isAdmin ?? false

  const canAdd            = true
  const canEdit           = true
  const canDelete         = isAdmin
  const canCreateCategory = true

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
