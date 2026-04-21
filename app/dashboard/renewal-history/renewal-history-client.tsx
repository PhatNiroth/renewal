"use client"

import { useState } from "react"
import { RiHistoryLine, RiSearchLine } from "@remixicon/react"
import { Input } from "@/components/ui/input"

type Log = {
  id: string
  previousDate: string
  newDate: string
  createdAt: string
  subscription: { planName: string; vendor: { name: string } }
  renewedBy: { name: string | null; email: string }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type Period = "ALL" | "MONTH" | "QUARTER" | "SEMESTER" | "YEAR" | "CUSTOM"

function getPeriodRange(period: Period, customFrom: string, customTo: string): { start: Date; end: Date } | null {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (period === "MONTH")    return { start: new Date(y, m, 1),                 end: new Date(y, m + 1, 1) }
  if (period === "QUARTER")  { const q = Math.floor(m / 3) * 3; return { start: new Date(y, q, 1), end: new Date(y, q + 3, 1) } }
  if (period === "SEMESTER") { const s = m < 6 ? 0 : 6;         return { start: new Date(y, s, 1), end: new Date(y, s + 6, 1) } }
  if (period === "YEAR")     return { start: new Date(y, 0, 1),                 end: new Date(y + 1, 0, 1) }
  if (period === "CUSTOM" && (customFrom || customTo)) {
    const start = customFrom ? new Date(customFrom) : new Date(0)
    const end   = customTo   ? new Date(new Date(customTo).getTime() + 86_400_000) : new Date(8640000000000000)
    return { start, end }
  }
  return null
}

export function RenewalHistoryClient({
  logs,
  vendors,
  users,
}: {
  logs: Log[]
  vendors: string[]
  users: string[]
}) {
  const [search, setSearch] = useState("")
  const [vendorFilter, setVendorFilter] = useState("")
  const [userFilter, setUserFilter] = useState("")
  const [period, setPeriod] = useState<Period>("ALL")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const range = getPeriodRange(period, customFrom, customTo)

  const filtered = logs.filter(log => {
    if (vendorFilter && log.subscription.vendor.name !== vendorFilter) return false
    if (userFilter && (log.renewedBy.name || log.renewedBy.email) !== userFilter) return false
    if (range) {
      const d = new Date(log.createdAt)
      if (d < range.start || d >= range.end) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const match =
        log.subscription.vendor.name.toLowerCase().includes(q) ||
        log.subscription.planName.toLowerCase().includes(q) ||
        (log.renewedBy.name || log.renewedBy.email).toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const selectClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor, plan, or user…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={vendorFilter}
          onChange={e => setVendorFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Vendors</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className={selectClass}
        >
          <option value="">All Users</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as Period)}
          className={selectClass}
        >
          <option value="ALL">All Time</option>
          <option value="MONTH">This Month</option>
          <option value="QUARTER">This Quarter</option>
          <option value="SEMESTER">This Semester</option>
          <option value="YEAR">This Year</option>
          <option value="CUSTOM">Custom Range</option>
        </select>
        {period === "CUSTOM" && (
          <>
            <Input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-auto"
              aria-label="From date"
            />
            <Input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="w-auto"
              aria-label="To date"
            />
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <RiHistoryLine className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {logs.length === 0 ? "No renewal history yet." : "No results match your filters."}
          </p>
          {logs.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">Renewal logs appear here when subscriptions are marked as renewed.</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Subscription</th>
                  <th className="hidden xl:table-cell px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Previous Date</th>
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">New Date</th>
                  <th className="hidden xl:table-cell px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Renewed By</th>
                  <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Renewed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 xl:px-6 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {log.subscription.vendor.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground truncate">{log.subscription.vendor.name}</span>
                      </div>
                    </td>
                    <td className="px-4 xl:px-6 py-3 text-foreground truncate">{log.subscription.planName}</td>
                    <td className="hidden xl:table-cell px-4 xl:px-6 py-3 text-muted-foreground">{fmtDate(log.previousDate)}</td>
                    <td className="px-4 xl:px-6 py-3 text-foreground">{fmtDate(log.newDate)}</td>
                    <td className="hidden xl:table-cell px-4 xl:px-6 py-3 text-foreground truncate">{log.renewedBy.name || log.renewedBy.email}</td>
                    <td className="px-4 xl:px-6 py-3 text-muted-foreground">{fmtDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list (mobile) */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map(log => (
              <div key={log.id} className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {log.subscription.vendor.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{log.subscription.vendor.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{log.subscription.planName}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Previous Date</div>
                    <div className="text-foreground">{fmtDate(log.previousDate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">New Date</div>
                    <div className="text-foreground">{fmtDate(log.newDate)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Renewed By</div>
                    <div className="text-foreground truncate">{log.renewedBy.name || log.renewedBy.email}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Renewed At</div>
                    <div className="text-foreground">{fmtDate(log.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {logs.length} records
          </div>
        </div>
      )}
    </>
  )
}
