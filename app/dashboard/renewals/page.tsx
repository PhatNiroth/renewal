import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import {
  RiAlarmLine, RiCalendarCheckLine, RiErrorWarningLine, RiCloseLine,
} from "@remixicon/react"
import { MarkRenewedButton } from "@/components/renewals/mark-renewed-button"

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}
function fmt(n: number) {
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
}

const cycleLabel: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly", ONE_TIME: "One-time",
}

export default async function RenewalsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean; edit?: boolean }> }
  if (!u.isAdmin && !u.permissions?.RENEWALS?.view) redirect("/dashboard")

  const canRenew = u.isAdmin || !!u.permissions?.RENEWALS?.edit

  const in30days = new Date()
  in30days.setDate(in30days.getDate() + 30)

  const subscriptions = await db.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      renewalDate: { lte: in30days },
    },
    include: { vendor: true, responsible: true },
    orderBy: { renewalDate: "asc" },
  })

  type Sub = (typeof subscriptions)[number]

  const now = Date.now()
  const in7  = subscriptions.filter((s: Sub) => { const d = daysUntil(s.renewalDate); return d >= 0 && d <= 7 })
  const in30 = subscriptions.filter((s: Sub) => { const d = daysUntil(s.renewalDate); return d >= 0 && d <= 30 })
  const overdue = subscriptions.filter((s: Sub) => new Date(s.renewalDate).getTime() < now)

  const totalAt7d  = in7.reduce((sum: number, s: Sub)  => sum + s.cost, 0)
  const totalAt30d = in30.reduce((sum: number, s: Sub) => sum + s.cost, 0)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Renewals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming renewal dates for all active company subscriptions.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Due in 7 Days",  value: in7.length.toString(),    sub: `${fmt(totalAt7d)} at stake`    },
          { label: "Due in 30 Days", value: in30.length.toString(),   sub: `${fmt(totalAt30d)} total`      },
          { label: "Overdue",        value: overdue.length.toString(), sub: overdue.length > 0 ? "Needs attention" : "All clear" },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4 md:p-5">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground tracking-tight">{card.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">All Upcoming Renewals</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Active subscriptions sorted by renewal date</p>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Plan</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Cost</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Cycle</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Renewal Date</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Due In</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Responsible</th>
                {canRenew && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={canRenew ? 8 : 7} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    No active subscriptions found.
                  </td>
                </tr>
              ) : subscriptions.map((sub: Sub) => {
                const days    = daysUntil(sub.renewalDate)
                const isToday = days === 0
                const urgent  = days <= 3
                const warn    = days <= 7

                let urgencyClass = "bg-muted text-muted-foreground"
                let UrgencyIcon = RiCalendarCheckLine
                let urgencyLabel = `${days}d`

                if (days < 0) {
                  urgencyClass = "bg-destructive/10 text-destructive"
                  UrgencyIcon = RiCloseLine
                  urgencyLabel = `${Math.abs(days)}d ago`
                } else if (isToday) {
                  urgencyClass = "bg-destructive/10 text-destructive"
                  UrgencyIcon = RiErrorWarningLine
                  urgencyLabel = "Today"
                } else if (urgent) {
                  urgencyClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  UrgencyIcon = RiAlarmLine
                } else if (warn) {
                  urgencyClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  UrgencyIcon = RiCalendarCheckLine
                }

                return (
                  <tr key={sub.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-foreground">{sub.vendor.name}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{sub.planName}</td>
                    <td className="px-6 py-3.5 font-medium text-foreground">{fmt(sub.cost)}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{cycleLabel[sub.billingCycle] ?? sub.billingCycle}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{fmtDate(sub.renewalDate)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${urgencyClass}`}>
                        <UrgencyIcon className="size-3" />
                        {urgencyLabel}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground">
                      {sub.responsible?.name ?? sub.responsible?.email ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {canRenew && (
                      <td className="px-6 py-3.5 text-right">
                        <MarkRenewedButton subscriptionId={sub.id} />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Card list (mobile) */}
        <div className="md:hidden divide-y divide-border">
          {subscriptions.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No active subscriptions found.
            </div>
          ) : subscriptions.map((sub: Sub) => {
            const days    = daysUntil(sub.renewalDate)
            const isToday = days === 0
            const urgent  = days <= 3
            const warn    = days <= 7

            let urgencyClass = "bg-muted text-muted-foreground"
            let UrgencyIcon = RiCalendarCheckLine
            let urgencyLabel = `${days}d`

            if (days < 0) {
              urgencyClass = "bg-destructive/10 text-destructive"
              UrgencyIcon = RiCloseLine
              urgencyLabel = `${Math.abs(days)}d ago`
            } else if (isToday) {
              urgencyClass = "bg-destructive/10 text-destructive"
              UrgencyIcon = RiErrorWarningLine
              urgencyLabel = "Today"
            } else if (urgent) {
              urgencyClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              UrgencyIcon = RiAlarmLine
            } else if (warn) {
              urgencyClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              UrgencyIcon = RiCalendarCheckLine
            }

            return (
              <div key={sub.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{sub.vendor.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{sub.planName}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium shrink-0 ${urgencyClass}`}>
                    <UrgencyIcon className="size-3" />
                    {urgencyLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Cost</div>
                    <div className="font-medium text-foreground">{fmt(sub.cost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cycle</div>
                    <div className="text-foreground">{cycleLabel[sub.billingCycle] ?? sub.billingCycle}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Renewal</div>
                    <div className="text-foreground">{fmtDate(sub.renewalDate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Responsible</div>
                    <div className="text-foreground truncate">{sub.responsible?.name ?? sub.responsible?.email ?? "—"}</div>
                  </div>
                </div>

                {canRenew && (
                  <div className="pt-1">
                    <MarkRenewedButton subscriptionId={sub.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-4 py-3 md:px-6 border-t border-border text-xs text-muted-foreground">
          {subscriptions.length} subscription{subscriptions.length !== 1 ? "s" : ""} shown
        </div>
      </div>
    </div>
  )
}
