"use client"

import { useState, useTransition, useEffect } from "react"
import {
  RiAddLine, RiSearchLine, RiFilterLine,
  RiArrowUpLine, RiArrowDownLine, RiCheckLine,
  RiTimeLine, RiLoader4Line, RiAlertLine, RiCloseLine,
  RiEditLine, RiDeleteBinLine, RiLink,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { createSubscription, updateSubscription, deleteSubscription } from "@/app/actions/subscriptions"
import type { Subscription, Vendor, User } from "@prisma/client"

type SubscriptionFull = Subscription & { vendor: Vendor; responsible: User | null }

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  ACTIVE:         { label: "Active",         className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: RiCheckLine  },
  EXPIRING_SOON:  { label: "Expiring Soon",  className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",      icon: RiAlertLine  },
  EXPIRED:        { label: "Expired",        className: "bg-destructive/10 text-destructive",                       icon: RiCloseLine  },
  CANCELLED:      { label: "Cancelled",      className: "bg-muted text-muted-foreground",                          icon: RiCloseLine  },
  PENDING:        { label: "Pending",        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",         icon: RiTimeLine   },
}

const cycleLabel: Record<string, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", YEARLY: "Yearly", ONE_TIME: "One-time",
}

const ALL_STATUSES = ["ACTIVE", "EXPIRING_SOON", "EXPIRED", "CANCELLED", "PENDING"]

function fmt(n: number) { return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` }
function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: Date | string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}
function toInput(d: Date | string) { return new Date(d).toISOString().split("T")[0] }

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddSubscriptionModal({
  vendors,
  users,
  onClose,
  onSuccess,
}: {
  vendors: Vendor[]
  users: Pick<User, "id" | "name" | "email">[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [today, setToday] = useState("")

  useEffect(() => {
    setToday(new Date().toISOString().split("T")[0])
  }, [])

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createSubscription(formData)
      if ("error" in result) { setError(result.error) }
      else { onSuccess(); onClose() }
    })
  }

  return (
    <Modal title="Add Subscription" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Vendor <span className="text-destructive">*</span></label>
            <select name="vendorId" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select vendor…</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Plan / Service Name <span className="text-destructive">*</span></label>
            <Input name="planName" placeholder="e.g. Pro, Business, Enterprise" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cost (USD) <span className="text-destructive">*</span></label>
            <Input name="cost" type="number" min="0.01" step="0.01" placeholder="0.00" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Billing Cycle</label>
            <select name="billingCycle" defaultValue="MONTHLY" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {Object.entries(cycleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Start Date <span className="text-destructive">*</span></label>
            <Input name="startDate" type="date" defaultValue={today} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Renewal Date <span className="text-destructive">*</span></label>
            <Input name="renewalDate" type="date" required />
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Responsible Person</label>
            <select name="responsibleId" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Document Location</label>
            <Input name="documentPath" placeholder="e.g. https://nextcloud.krawma.com/IT/contracts/adobe.pdf or IT/contracts/adobe.pdf" />
            <p className="text-xs text-muted-foreground">URL or path to the contract/document in Nextcloud or other storage.</p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea name="notes" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Optional notes…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : <><RiAddLine data-icon="inline-start" />Add Subscription</>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditSubscriptionModal({
  sub,
  users,
  onClose,
  onSuccess,
}: {
  sub: SubscriptionFull
  users: Pick<User, "id" | "name" | "email">[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const cost = fd.get("cost") as string
    const costCents = Math.round(parseFloat(cost || "0") * 100)
    startTransition(async () => {
      const result = await updateSubscription(sub.id, {
        planName:      fd.get("planName") as string,
        cost:          costCents,
        billingCycle:  fd.get("billingCycle") as "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME",
        renewalDate:   new Date(fd.get("renewalDate") as string),
        status:        fd.get("status") as "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED" | "PENDING",
        responsibleId: (fd.get("responsibleId") as string) || null,
        notes:         (fd.get("notes") as string) || null,
        documentPath:  (fd.get("documentPath") as string) || null,
      })
      if ("error" in result) { setError(result.error) }
      else { onSuccess(); onClose() }
    })
  }

  return (
    <Modal title={`Edit: ${sub.vendor.name} — ${sub.planName}`} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Vendor</label>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{sub.vendor.name}</div>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Plan / Service Name <span className="text-destructive">*</span></label>
            <Input name="planName" defaultValue={sub.planName} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cost (USD) <span className="text-destructive">*</span></label>
            <Input name="cost" type="number" min="0" step="0.01" defaultValue={(sub.cost / 100).toFixed(2)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Billing Cycle</label>
            <select name="billingCycle" defaultValue={sub.billingCycle} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {Object.entries(cycleLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Renewal Date <span className="text-destructive">*</span></label>
            <Input name="renewalDate" type="date" defaultValue={toInput(sub.renewalDate)} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Status</label>
            <select name="status" defaultValue={sub.status} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {ALL_STATUSES.map(s => <option key={s} value={s}>{statusConfig[s]?.label ?? s}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Responsible Person</label>
            <select name="responsibleId" defaultValue={sub.responsible?.id ?? ""} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Document Location</label>
            <Input name="documentPath" defaultValue={sub.documentPath ?? ""} placeholder="e.g. https://nextcloud.krawma.com/IT/contracts/adobe.pdf or IT/contracts/adobe.pdf" />
            <p className="text-xs text-muted-foreground">URL or path to the contract/document in Nextcloud or other storage.</p>
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Notes</label>
            <textarea name="notes" rows={2} defaultValue={sub.notes ?? ""} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Optional notes…" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsClient({
  subscriptions,
  vendors,
  users,
  canEdit,
  canAdd,
}: {
  subscriptions: SubscriptionFull[]
  vendors: Vendor[]
  users: Pick<User, "id" | "name" | "email">[]
  canEdit: boolean
  canAdd: boolean
}) {
  const [search, setSearch]             = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [sortKey, setSortKey]           = useState<"vendor" | "cost" | "renewal" | "cycle">("renewal")
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("asc")
  const [showModal, setShowModal]       = useState(false)
  const [editing, setEditing]           = useState<SubscriptionFull | null>(null)
  const [deleting, setDeleting]         = useState<SubscriptionFull | null>(null)
  const [deleteError, setDeleteError]   = useState<string | null>(null)
  const [, startTransition]             = useTransition()

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const filtered = subscriptions
    .filter(s => statusFilter === "ALL" || s.status === statusFilter)
    .filter(s => {
      if (!search) return true
      const q = search.toLowerCase()
      return s.vendor.name.toLowerCase().includes(q) || s.planName.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "vendor")  cmp = a.vendor.name.localeCompare(b.vendor.name)
      if (sortKey === "cost")    cmp = a.cost - b.cost
      if (sortKey === "renewal") cmp = new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime()
      if (sortKey === "cycle")   cmp = a.billingCycle.localeCompare(b.billingCycle)
      return sortDir === "asc" ? cmp : -cmp
    })

  const SortIcon = ({ col }: { col: typeof sortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <RiArrowUpLine className="size-3.5 ml-1 inline" /> : <RiArrowDownLine className="size-3.5 ml-1 inline" />
      : null

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id)
      if ("error" in result) { setDeleteError(result.error) }
      else { setDeleting(null); setDeleteError(null) }
    })
  }

  return (
    <>
      {showModal && (
        <AddSubscriptionModal
          vendors={vendors}
          users={users}
          onClose={() => setShowModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {editing && (
        <EditSubscriptionModal
          sub={editing}
          users={users}
          onClose={() => setEditing(null)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {deleting && (
        <Modal title="Delete Subscription" onClose={() => { setDeleting(null); setDeleteError(null) }}>
          <div className="space-y-4">
            {deleteError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{deleteError}</div>}
            <p className="text-sm text-muted-foreground">
              Delete <strong className="text-foreground">{deleting.vendor.name} — {deleting.planName}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleting(null); setDeleteError(null) }}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleting.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Subscriptions</h1>
            <p className="mt-1 text-sm text-muted-foreground">All company service subscriptions and contracts.</p>
          </div>
          {canAdd && (
            <Button size="sm" onClick={() => setShowModal(true)}>
              <RiAddLine data-icon="inline-start" />Add Subscription
            </Button>
          )}
        </div>

        {/* Table card */}
        <div className="rounded-xl border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-6 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search vendor or plan…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <RiFilterLine className="size-4 text-muted-foreground shrink-0" />
              {["ALL", ...ALL_STATUSES].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {s === "ALL" ? "All" : statusConfig[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("vendor")}>
                    Vendor <SortIcon col="vendor" />
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("cost")}>
                    Cost <SortIcon col="cost" />
                  </th>
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("cycle")}>
                    Cycle <SortIcon col="cycle" />
                  </th>
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("renewal")}>
                    Renewal <SortIcon col="renewal" />
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Responsible</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Document</th>
                  {canEdit && <th className="px-6 py-3 text-left font-medium text-muted-foreground">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="px-6 py-16 text-center text-sm text-muted-foreground">
                      {subscriptions.length === 0
                        ? "No subscriptions yet. Click \"Add Subscription\" to create one."
                        : "No subscriptions match your search."}
                    </td>
                  </tr>
                ) : filtered.map(sub => {
                  const status    = statusConfig[sub.status]
                  const StatusIcon = status?.icon ?? RiCheckLine
                  const days      = daysUntil(sub.renewalDate)
                  const isUrgent  = days <= 7 && days >= 0 && sub.status === "ACTIVE"

                  return (
                    <tr key={sub.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-foreground">{sub.vendor.name}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{sub.planName}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${status?.className}`}>
                          <StatusIcon className="size-3" />
                          {status?.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-foreground">{fmt(sub.cost)}</td>
                      <td className="px-6 py-3.5 text-muted-foreground">{cycleLabel[sub.billingCycle] ?? sub.billingCycle}</td>
                      <td className="px-6 py-3.5">
                        <span className={isUrgent ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}>
                          {fmtDate(sub.renewalDate)}
                        </span>
                        {isUrgent && (
                          <span className="ml-1.5 inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            {days}d
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">
                        {sub.responsible?.name ?? sub.responsible?.email ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-6 py-3.5">
                        {sub.documentPath ? (
                          sub.documentPath.startsWith("http")
                            ? <a href={sub.documentPath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs"><RiLink className="size-3.5" />View</a>
                            : <span className="text-xs text-muted-foreground font-mono">{sub.documentPath}</span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      {canEdit && (
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon-sm" onClick={() => setEditing(sub)}>
                              <RiEditLine className="size-4" />
                            </Button>
                            <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(sub); setDeleteError(null) }}>
                              <RiDeleteBinLine className="size-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filtered.length} of {subscriptions.length} subscriptions</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm" disabled>Next</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
