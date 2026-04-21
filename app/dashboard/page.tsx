import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  RiStackLine, RiMoneyDollarCircleLine, RiCalendarCheckLine,
  RiAlertLine, RiArrowRightLine,
} from "@remixicon/react"

function fmt(n: number) {
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

const statusColors: Record<string, string> = {
  ACTIVE:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  EXPIRING_SOON: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EXPIRED:       "bg-destructive/10 text-destructive",
  CANCELLED:     "bg-muted text-muted-foreground",
}
const statusLabels: Record<string, string> = {
  ACTIVE: "Active", EXPIRING_SOON: "Expiring Soon",
  EXPIRED: "Expired", CANCELLED: "Cancelled",
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const u = session.user as { isAdmin?: boolean; permissions?: Record<string, { view?: boolean }> }
  const canViewSubs    = u.isAdmin || u.permissions?.SUBSCRIPTIONS?.view === true
  const canViewRenewals = u.isAdmin || u.permissions?.RENEWALS?.view === true

  const subscriptions = (canViewSubs || canViewRenewals) ? await db.subscription.findMany({
    include: { vendor: true, responsible: true },
    orderBy: { renewalDate: "asc" },
  }) : []

  type Sub = (typeof subscriptions)[number]

  const active    = subscriptions.filter((s: Sub) => s.status === "ACTIVE" || s.status === "EXPIRING_SOON")
  const expiring  = subscriptions.filter((s: Sub) => {
    const d = daysUntil(s.renewalDate)
    return d >= 0 && d <= 7 && s.status === "ACTIVE"
  })
  const expired   = subscriptions.filter((s: Sub) => s.status === "EXPIRED")
  const totalCostMonthly = active.reduce((sum: number, s: Sub) => {
    if (s.billingCycle === "MONTHLY")   return sum + s.cost
    if (s.billingCycle === "QUARTERLY") return sum + Math.round(s.cost / 3)
    if (s.billingCycle === "SEMESTER")  return sum + Math.round(s.cost / 6)
    if (s.billingCycle === "YEARLY")    return sum + Math.round(s.cost / 12)
    return sum
  }, 0)

  const upcomingRenewals = subscriptions
    .filter((s: Sub) => {
      const d = daysUntil(s.renewalDate)
      return d >= 0 && d <= 30 && (s.status === "ACTIVE" || s.status === "EXPIRING_SOON")
    })
    .slice(0, 5)

  const recentSubs = [...subscriptions]
    .sort((a: Sub, b: Sub) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Company subscription & renewal summary.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Monthly Spend",
            value: fmt(totalCostMonthly),
            sub: "estimated across all active",
            icon: RiMoneyDollarCircleLine,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Active Subscriptions",
            value: active.length.toString(),
            sub: `${subscriptions.length} total tracked`,
            icon: RiStackLine,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Expiring in 7 Days",
            value: expiring.length.toString(),
            sub: expiring.length > 0 ? "Action needed" : "All clear",
            icon: RiCalendarCheckLine,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            label: "Expired / Overdue",
            value: expired.length.toString(),
            sub: expired.length > 0 ? "Needs review" : "None overdue",
            icon: RiAlertLine,
            color: "text-destructive",
            bg: "bg-destructive/10",
          },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4 md:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className={`flex size-8 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`size-4 ${stat.color}`} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground tracking-tight">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent subscriptions */}
        {canViewSubs && <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-foreground">Recent Subscriptions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest added</p>
            </div>
            <Link href="/dashboard/subscriptions">
              <button className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                View all <RiArrowRightLine className="size-3.5" />
              </button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentSubs.length === 0 ? (
              <p className="px-4 md:px-6 py-8 text-center text-sm text-muted-foreground">No subscriptions yet.</p>
            ) : recentSubs.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 px-4 md:px-6 py-3.5 hover:bg-muted/40 transition-colors">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {sub.vendor.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{sub.vendor.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{sub.planName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-foreground">{fmt(sub.cost)}</p>
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${statusColors[sub.status]}`}>
                    {statusLabels[sub.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* Upcoming renewals */}
        {canViewRenewals && <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-foreground">Upcoming Renewals</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Next 30 days</p>
            </div>
            <Link href="/dashboard/renewals">
              <button className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                View all <RiArrowRightLine className="size-3.5" />
              </button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {upcomingRenewals.length === 0 ? (
              <p className="px-4 md:px-6 py-8 text-center text-sm text-muted-foreground">No renewals in the next 30 days.</p>
            ) : upcomingRenewals.map(sub => {
              const days = daysUntil(sub.renewalDate)
              const urgent = days <= 7
              return (
                <div key={sub.id} className="flex items-center gap-3 px-4 md:px-6 py-3.5 hover:bg-muted/40 transition-colors">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${urgent ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                    {sub.vendor.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{sub.vendor.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(sub.renewalDate)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">{fmt(sub.cost)}</p>
                    <span className={`text-xs font-medium ${urgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {days === 0 ? "Today" : `${days}d left`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>}
      </div>
    </div>
  )
}
