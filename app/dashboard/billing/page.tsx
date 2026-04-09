import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import BillingClient from "./billing-client"

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean; add?: boolean; delete?: boolean }> }
  if (!u.isAdmin && !u.permissions?.PAYMENTS?.view) redirect("/dashboard")

  const canAdd    = u.isAdmin || u.permissions?.PAYMENTS?.add    === true
  const canDelete = u.isAdmin || u.permissions?.PAYMENTS?.delete === true

  const [payments, subscriptions] = await Promise.all([
    db.payment.findMany({
      include: {
        subscription: { include: { vendor: true } },
        paidBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    db.subscription.findMany({
      include: { vendor: true },
      where: { status: { not: "CANCELLED" } },
      orderBy: { vendor: { name: "asc" } },
    }),
  ])

  return <BillingClient payments={payments} subscriptions={subscriptions} canAdd={!!canAdd} canDelete={!!canDelete} />
}
