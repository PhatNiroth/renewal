"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiCalendarLine, RiCheckLine, RiCloseLine, RiEditLine, RiLoader4Line } from "@remixicon/react"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

type Vendor = { id: string; name: string }
type User   = { id: string; name: string | null; email: string }
type Sub = {
  id: string; planName: string; cost: number; billingCycle: string; status: string
  renewalDate: string; vendor: Vendor; responsible: User | null
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  EXPIRING_SOON: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EXPIRED:       "bg-destructive/10 text-destructive",
}
const STATUS_LABELS: Record<string, string> = { ACTIVE: "Active", EXPIRING_SOON: "Expiring Soon", EXPIRED: "Expired" }

function fmt(n: number) { return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}` }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return "Today"
  return `in ${diff}d`
}


export default function AdminRenewalsPage() {
  const [subs, setSubs]           = useState<Sub[]>([])
  const [loading, setLoading]     = useState(true)
  const [editDate, setEditDate]   = useState<Sub | null>(null)
  const [confirming, setConfirming] = useState<{ sub: Sub; action: "mark_renewed" | "cancel" } | null>(null)
  const [newDate, setNewDate]     = useState("")
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/renewals")
    setSubs(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function doAction(id: string, action: string, extra?: object) {
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/renewals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return false }
    return true
  }

  async function handleUpdateDate() {
    if (!editDate || !newDate) return
    const ok = await doAction(editDate.id, "update_date", { renewalDate: newDate })
    if (ok) { setEditDate(null); load() }
  }

  async function handleConfirm() {
    if (!confirming) return
    const ok = await doAction(confirming.sub.id, confirming.action)
    if (ok) { setConfirming(null); load() }
  }

  const expiringSoon = subs.filter(s => s.status === "EXPIRING_SOON" || s.status === "EXPIRED")
  const active       = subs.filter(s => s.status === "ACTIVE")

  function SubRow({ s }: { s: Sub }) {
    const overdue = new Date(s.renewalDate).getTime() < Date.now()
    return (
      <tr className="hover:bg-muted/40 transition-colors">
        <td className="px-6 py-3.5">
          <p className="font-medium text-foreground">{s.vendor.name}</p>
          <p className="text-xs text-muted-foreground">{s.planName}</p>
        </td>
        <td className="px-6 py-3.5">
          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", STATUS_COLORS[s.status])}>
            {STATUS_LABELS[s.status] ?? s.status}
          </span>
        </td>
        <td className="px-6 py-3.5">
          <p className="text-foreground">{fmtDate(s.renewalDate)}</p>
          <p className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>{daysUntil(s.renewalDate)}</p>
        </td>
        <td className="px-6 py-3.5 font-medium text-foreground">{fmt(s.cost)}</td>
        <td className="px-6 py-3.5 text-muted-foreground text-sm">{s.responsible?.name ?? s.responsible?.email ?? <span className="opacity-40">—</span>}</td>
        <td className="px-6 py-3.5">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="icon-sm" title="Edit renewal date" onClick={() => { setEditDate(s); setNewDate(new Date(s.renewalDate).toISOString().split("T")[0]); setError(null) }}>
              <RiEditLine className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" title="Mark as renewed" className="text-emerald-600 hover:text-emerald-600" onClick={() => { setConfirming({ sub: s, action: "mark_renewed" }); setError(null) }}>
              <RiCheckLine className="size-4" />
            </Button>
            <Button variant="outline" size="icon-sm" title="Cancel subscription" className="text-destructive hover:text-destructive" onClick={() => { setConfirming({ sub: s, action: "cancel" }); setError(null) }}>
              <RiCloseLine className="size-4" />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  function SubCard({ s }: { s: Sub }) {
    const overdue = new Date(s.renewalDate).getTime() < Date.now()
    return (
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{s.vendor.name}</div>
            <div className="text-xs text-muted-foreground truncate">{s.planName}</div>
          </div>
          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0", STATUS_COLORS[s.status])}>
            {STATUS_LABELS[s.status] ?? s.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <div className="text-muted-foreground">Renewal Date</div>
            <div className="text-foreground">{fmtDate(s.renewalDate)}</div>
            <div className={cn("text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>{daysUntil(s.renewalDate)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Cost</div>
            <div className="font-medium text-foreground">{fmt(s.cost)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-muted-foreground">Responsible</div>
            <div className="text-foreground truncate">{s.responsible?.name ?? s.responsible?.email ?? "—"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditDate(s); setNewDate(new Date(s.renewalDate).toISOString().split("T")[0]); setError(null) }}>
            <RiEditLine className="size-4" data-icon="inline-start" />Edit Date
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-emerald-600 hover:text-emerald-600" onClick={() => { setConfirming({ sub: s, action: "mark_renewed" }); setError(null) }}>
            <RiCheckLine className="size-4" data-icon="inline-start" />Renew
          </Button>
          <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => { setConfirming({ sub: s, action: "cancel" }); setError(null) }}>
            <RiCloseLine className="size-4" data-icon="inline-start" />Cancel
          </Button>
        </div>
      </div>
    )
  }

  const tableHead = (
    <thead>
      <tr className="border-b border-border">
        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Subscription</th>
        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Renewal Date</th>
        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Cost</th>
        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Responsible</th>
        <th className="px-6 py-3 text-left font-medium text-muted-foreground">Action</th>
      </tr>
    </thead>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Renewals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mark renewals as done, update dates, or cancel subscriptions.</p>
      </div>

      {/* Needs attention */}
      {expiringSoon.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <RiCalendarLine className="size-4 text-destructive" />Needs Attention ({expiringSoon.length})
          </h2>
          <div className="rounded-xl border border-destructive/20 bg-card">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                {tableHead}
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center"><RiLoader4Line className="size-5 animate-spin inline text-muted-foreground" /></td></tr>
                  ) : expiringSoon.map(s => <SubRow key={s.id} s={s} />)}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-border">
              {loading ? (
                <div className="py-8 text-center"><RiLoader4Line className="size-5 animate-spin inline text-muted-foreground" /></div>
              ) : expiringSoon.map(s => <SubCard key={s.id} s={s} />)}
            </div>
          </div>
        </div>
      )}

      {/* Active */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Active Subscriptions ({active.length})</h2>
        <div className="rounded-xl border border-border bg-card">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              {tableHead}
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center"><RiLoader4Line className="size-5 animate-spin inline text-muted-foreground" /></td></tr>
                ) : active.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No active subscriptions.</td></tr>
                ) : active.map(s => <SubRow key={s.id} s={s} />)}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-border">
            {loading ? (
              <div className="py-8 text-center"><RiLoader4Line className="size-5 animate-spin inline text-muted-foreground" /></div>
            ) : active.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No active subscriptions.</div>
            ) : active.map(s => <SubCard key={s.id} s={s} />)}
          </div>
        </div>
      </div>

      {/* Edit date modal */}
      {editDate && (
        <Modal title={`Update Renewal Date`} onClose={() => setEditDate(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <p className="text-sm text-muted-foreground">{editDate.vendor.name} — {editDate.planName}</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">New Renewal Date</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDate(null)}>Cancel</Button>
              <Button onClick={handleUpdateDate} disabled={saving || !newDate}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Update Date"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm action modal */}
      {confirming && (
        <Modal
          title={confirming.action === "mark_renewed" ? "Mark as Renewed" : "Cancel Subscription"}
          onClose={() => setConfirming(null)}
        >
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            {confirming.action === "mark_renewed" ? (
              <p className="text-sm text-muted-foreground">
                Mark <strong className="text-foreground">{confirming.sub.vendor.name} — {confirming.sub.planName}</strong> as renewed?
                The renewal date will advance by one {confirming.sub.billingCycle.toLowerCase()} period and status will be set to Active.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cancel <strong className="text-foreground">{confirming.sub.vendor.name} — {confirming.sub.planName}</strong>?
                The status will be set to Cancelled.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(null)}>No, go back</Button>
              <Button
                variant={confirming.action === "cancel" ? "destructive" : "default"}
                onClick={handleConfirm}
                disabled={saving}
              >
                {saving ? <RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" /> : null}
                {confirming.action === "mark_renewed" ? "Yes, mark renewed" : "Yes, cancel"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
