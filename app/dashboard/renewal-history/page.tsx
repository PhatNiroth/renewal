import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { RiHistoryLine } from "@remixicon/react"

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default async function RenewalHistoryPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean }> }
  if (!u.isAdmin && !u.permissions?.RENEWALS?.view) {
    return (
      <div className="p-6 lg:p-8">
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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Renewal History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log of all subscription renewals — who renewed, when, and what changed.</p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <RiHistoryLine className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No renewal history yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Renewal logs appear here when subscriptions are marked as renewed.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subscription</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Previous Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">New Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Renewed By</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Renewed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {log.subscription.vendor.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{log.subscription.vendor.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{log.subscription.planName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(log.previousDate)}</td>
                    <td className="px-4 py-3 text-foreground">{fmtDate(log.newDate)}</td>
                    <td className="px-4 py-3 text-foreground">{log.renewedBy.name || log.renewedBy.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
