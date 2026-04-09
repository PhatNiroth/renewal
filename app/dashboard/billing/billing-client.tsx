"use client"

import { useState, useTransition, useEffect } from "react"
import {
  RiAddLine, RiSearchLine, RiFilterLine, RiCheckLine,
  RiLoader4Line, RiArrowUpLine, RiArrowDownLine, RiDeleteBinLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { recordPayment, deletePayment } from "@/app/actions/billing"

type PaymentRow = {
  id: string
  amount: number
  currency: string
  paidAt: Date
  note: string | null
  receiptUrl: string | null
  subscription: { id: string; planName: string; vendor: { name: string } }
  paidBy: { id: string; name: string | null; email: string } | null
}

type SubOption = {
  id: string
  planName: string
  vendor: { name: string }
}

function fmt(n: number) {
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const ALL_STATUSES = ["PAID"]

// ─── Add Payment Modal ────────────────────────────────────────────────────────

function AddPaymentModal({
  subscriptions,
  onClose,
  onSuccess,
}: {
  subscriptions: SubOption[]
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
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    startTransition(async () => {
      const result = await recordPayment(formData)
      if ("error" in result) { setError(result.error) }
      else { onSuccess(); onClose() }
    })
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Subscription <span className="text-destructive">*</span></label>
          <select name="subscriptionId" required className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Select subscription…</option>
            {subscriptions.map(s => (
              <option key={s.id} value={s.id}>{s.vendor.name} — {s.planName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Amount (USD) <span className="text-destructive">*</span></label>
            <Input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Payment Date <span className="text-destructive">*</span></label>
            <Input name="paidAt" type="date" defaultValue={today} required />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Note</label>
          <Input name="note" placeholder="e.g. Invoice #1234" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Receipt URL</label>
          <Input name="receiptUrl" type="url" placeholder="https://…" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : <><RiAddLine data-icon="inline-start" />Record Payment</>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BillingClient({
  payments,
  subscriptions,
  canAdd,
  canDelete,
}: {
  payments: PaymentRow[]
  subscriptions: SubOption[]
  canAdd: boolean
  canDelete: boolean
}) {
  const [search, setSearch]       = useState("")
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting]   = useState<PaymentRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [, startTransition]       = useTransition()
  const [sortKey, setSortKey]     = useState<"vendor" | "amount" | "date">("date")
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc")
  const [currentYear, setCurrentYear] = useState(0)

  useEffect(() => {
    setCurrentYear(new Date().getFullYear())
  }, [])

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePayment(id)
      if ("error" in result) { setDeleteError(result.error) }
      else { setDeleting(null); setDeleteError(null) }
    })
  }

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = payments
    .filter(p => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        p.subscription.vendor.name.toLowerCase().includes(q) ||
        p.subscription.planName.toLowerCase().includes(q) ||
        (p.note ?? "").toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "vendor") cmp = a.subscription.vendor.name.localeCompare(b.subscription.vendor.name)
      if (sortKey === "amount") cmp = a.amount - b.amount
      if (sortKey === "date")   cmp = new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
      return sortDir === "asc" ? cmp : -cmp
    })

  const SortIcon = ({ col }: { col: typeof sortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <RiArrowUpLine className="size-3.5 ml-1 inline" /> : <RiArrowDownLine className="size-3.5 ml-1 inline" />
      : null

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      {showModal && (
        <AddPaymentModal
          subscriptions={subscriptions}
          onClose={() => setShowModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {deleting && (
        <Modal title="Delete Payment" onClose={() => { setDeleting(null); setDeleteError(null) }}>
          <div className="space-y-4">
            {deleteError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{deleteError}</div>}
            <p className="text-sm text-muted-foreground">
              Delete payment of <strong className="text-foreground">${(deleting.amount / 100).toFixed(2)}</strong> for <strong className="text-foreground">{deleting.subscription.vendor.name}</strong>? This cannot be undone.
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
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manual payment records for all company subscriptions.</p>
          </div>
          {canAdd && (
            <Button size="sm" onClick={() => setShowModal(true)}>
              <RiAddLine data-icon="inline-start" />Record Payment
            </Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Total Recorded",   value: fmt(totalPaid),                          sub: "all time"               },
            { label: "Payments This Year",value: currentYear ? payments.filter(p => new Date(p.paidAt).getFullYear() === currentYear).length.toString() : "—", sub: currentYear ? currentYear.toString() : "" },
            { label: "Subscriptions Paid", value: new Set(payments.map(p => p.subscription.id)).size.toString(), sub: "unique subscriptions" },
          ].map(card => (
            <div key={card.label} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground tracking-tight">{card.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-6 py-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search vendor or note…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <RiFilterLine className="size-4 text-muted-foreground" />
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <RiCheckLine className="size-3" /> Paid
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("vendor")}>
                    Vendor / Plan <SortIcon col="vendor" />
                  </th>
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("amount")}>
                    Amount <SortIcon col="amount" />
                  </th>
                  <th className="cursor-pointer select-none px-6 py-3 text-left font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => toggleSort("date")}>
                    Paid On <SortIcon col="date" />
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Recorded By</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Note</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Receipt</th>
                  {canDelete && <th className="px-6 py-3 text-left font-medium text-muted-foreground">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canDelete ? 7 : 6} className="px-6 py-16 text-center text-sm text-muted-foreground">
                      {payments.length === 0
                        ? "No payments recorded yet. Click \"Record Payment\" to add one."
                        : "No payments match your search."}
                    </td>
                  </tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground">{p.subscription.vendor.name}</p>
                      <p className="text-xs text-muted-foreground">{p.subscription.planName}</p>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-foreground">{fmt(p.amount)}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{fmtDate(p.paidAt)}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">
                      {p.paidBy?.name ?? p.paidBy?.email ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground max-w-[200px] truncate">
                      {p.note ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      {p.receiptUrl ? (
                        <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2">View</a>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    {canDelete && (
                      <td className="px-6 py-3.5">
                        <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(p); setDeleteError(null) }}>
                          <RiDeleteBinLine className="size-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filtered.length} of {payments.length} payments</span>
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
