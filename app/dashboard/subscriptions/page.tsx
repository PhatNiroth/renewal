import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SubscriptionsClient from "./subscriptions-client"

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean; add?: boolean; edit?: boolean; delete?: boolean }> }
  if (!u.isAdmin && !u.permissions?.SUBSCRIPTIONS?.view) redirect("/dashboard")

  const [subscriptions, vendors, users] = await Promise.all([
    db.subscription.findMany({
      include: { vendor: true, responsible: true },
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

  const canEdit = u.isAdmin || u.permissions?.SUBSCRIPTIONS?.edit === true
  const canAdd  = u.isAdmin || u.permissions?.SUBSCRIPTIONS?.add  === true

  return (
    <SubscriptionsClient
      subscriptions={subscriptions}
      vendors={vendors}
      users={users}
      canEdit={!!canEdit}
      canAdd={!!canAdd}
    />
  )
}
