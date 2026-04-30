import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SubscriptionsClient from "./subscriptions-client"

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const isAdmin = session.user.isAdmin

  const [subscriptions, vendors, users, paymentMethods] = await Promise.all([
    db.subscription.findMany({
      include: { vendor: true, responsible: true, notificationConfigs: true, paymentMethod: true },
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
    db.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  const canEdit                = true
  const canAdd                 = true
  const canDelete              = isAdmin
  const canViewHistory         = true
  const canMarkRenewed         = true
  const canCreatePaymentMethod = true

  return (
    <SubscriptionsClient
      subscriptions={subscriptions}
      vendors={vendors}
      users={users}
      paymentMethods={paymentMethods}
      canEdit={!!canEdit}
      canAdd={!!canAdd}
      canDelete={!!canDelete}
      canViewHistory={!!canViewHistory}
      canMarkRenewed={!!canMarkRenewed}
      canCreatePaymentMethod={!!canCreatePaymentMethod}
    />
  )
}
