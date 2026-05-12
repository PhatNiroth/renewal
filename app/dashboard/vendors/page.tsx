import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { unstable_cache } from "next/cache"
import { CacheTags } from "@/lib/cache-tags"
import VendorsClient from "./vendors-client"

const getVendorsPageData = unstable_cache(
  () => Promise.all([
    db.vendor.findMany({
      include: { category: true, _count: { select: { subscriptions: true } } },
      orderBy: { name: "asc" },
    }),
    db.vendorCategory.findMany({ orderBy: { name: "asc" } }),
  ]),
  ["vendors-page"],
  { tags: [CacheTags.vendors], revalidate: 60 }
)

export default async function VendorsPage() {
  const session = await auth()
  const isAdmin = session?.user?.isAdmin ?? false

  const canAdd            = true
  const canEdit           = true
  const canDelete         = isAdmin
  const canCreateCategory = true

  const [vendors, categories] = await getVendorsPageData()

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
