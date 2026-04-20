import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { RenewalHistoryClient } from "./renewal-history-client"

export default async function RenewalHistoryPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean }> }
  if (!u.isAdmin && !u.permissions?.RENEWALS?.view) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    )
  }

  const logs = await db.renewalLog.findMany({
    include: {
      subscription: {
        include: { vendor: true },
      },
      renewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Serialize dates for client component
  const serializedLogs = logs.map(log => ({
    id: log.id,
    previousDate: log.previousDate.toISOString(),
    newDate: log.newDate.toISOString(),
    createdAt: log.createdAt.toISOString(),
    subscription: {
      planName: log.subscription.planName,
      vendor: { name: log.subscription.vendor.name },
    },
    renewedBy: {
      name: log.renewedBy.name,
      email: log.renewedBy.email,
    },
  }))

  // Extract unique vendors and users for filter dropdowns
  const vendors = [...new Set(logs.map(l => l.subscription.vendor.name))].sort()
  const users = [...new Set(logs.map(l => l.renewedBy.name || l.renewedBy.email))].sort()

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Renewal History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log of all subscription renewals — who renewed, when, and what changed.</p>
      </div>

      <RenewalHistoryClient logs={serializedLogs} vendors={vendors} users={users} />
    </div>
  )
}
