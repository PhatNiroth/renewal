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

  const filtered = logs.filter(log => {
    if (vendorFilter && log.subscription.vendor.name !== vendorFilter) return false
    if (userFilter && (log.renewedBy.name || log.renewedBy.email) !== userFilter) return false
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
                {filtered.map(log => (
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
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {filtered.length} of {logs.length} records
          </div>
        </div>
      )}
    </>
  )
}
