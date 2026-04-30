import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SubscriptionsClient from "./subscriptions-client"

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const isAdmin = session.user.isAdmin

  const [subscriptions, vendors, users] = await Promise.all([
    db.subscription.findMany({
      include: { vendor: true, responsible: true, notificationConfigs: true },
      orderBy: { renewalDate: "asc" },
    }),
    db.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <SubscriptionsClient
      subscriptions={subscriptions}
      vendors={vendors}
      users={users}
      canEdit={true}
      canAdd={true}
      canDelete={!!isAdmin}
      canViewHistory={true}
      canMarkRenewed={true}
    />
  )
}
