"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
import { cn } from "@/lib/utils"
import { Modal } from "@/components/ui/modal"
import { Combobox } from "@/components/ui/combobox"

type Vendor = { id: string; name: string }
type User   = { id: string; name: string | null; email: string }
type Sub = {
  id: string; planName: string; cost: number; billingCycle: string; status: string
  startDate: string; renewalDate: string; notes: string | null
  autoRenew: boolean
  vendor: Vendor; responsible: User | null
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  EXPIRING_SOON: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EXPIRED:       "bg-destructive/10 text-destructive",
  CANCELLED:     "bg-muted text-muted-foreground",
  PENDING:       "bg-blue-500/10 text-blue-600 dark:text-blue-400",
}
const STATUS_LABELS: Record<string, string> = { ACTIVE: "Active", EXPIRING_SOON: "Expiring Soon", EXPIRED: "Expired", CANCELLED: "Cancelled", PENDING: "Pending" }
const CYCLE_LABELS:  Record<string, string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", SEMESTER: "Semester", YEARLY: "Yearly", ONE_TIME: "One-time", CUSTOM: "Custom" }

function fmt(n: number) { return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}` }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
function toInput(d: string) { return new Date(d).toISOString().split("T")[0] }


type FormData = { vendorId: string; planName: string; cost: string; billingCycle: string; startDate: string; renewalDate: string; status: string; responsibleId: string; notes: string; autoRenew: boolean }

function emptyForm(): FormData {
  return { vendorId: "", planName: "", cost: "", billingCycle: "MONTHLY", startDate: "", renewalDate: "", status: "ACTIVE", responsibleId: "", notes: "", autoRenew: false }
}

function SubForm({ form, setForm, vendors, users }: { form: FormData; setForm: (f: FormData) => void; vendors: Vendor[]; users: User[] }) {
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <label className="text-sm font-medium text-foreground">Plan Name <span className="text-destructive">*</span></label>
          <Input value={form.planName} onChange={set("planName")} placeholder="e.g. Business Plan" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <label className="text-sm font-medium text-foreground">Vendor <span className="text-destructive">*</span></label>
          <Combobox
            options={vendors.map(v => ({ value: v.id, label: v.name }))}
            value={form.vendorId}
            onChange={id => setForm({ ...form, vendorId: id })}
            placeholder="Select vendor…"
            searchPlaceholder="Search vendors…"
            emptyMessage="No vendors match."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Cost (USD) <span className="text-destructive">*</span></label>
          <Input type="number" min="0" step="0.01" value={form.cost} onChange={set("cost")} placeholder="0.00" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Billing Cycle</label>
          <select value={form.billingCycle} onChange={set("billingCycle")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="SEMESTER">Semester</option>
            <option value="YEARLY">Yearly</option>
            <option value="ONE_TIME">One-time</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Start Date <span className="text-destructive">*</span></label>
          <Input type="date" value={form.startDate} onChange={set("startDate")} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Renewal Date <span className="text-destructive">*</span></label>
          <Input type="date" value={form.renewalDate} onChange={set("renewalDate")} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Status</label>
          <select value={form.status} onChange={set("status")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Responsible</label>
          <Combobox
            options={users.map(u => ({ value: u.id, label: u.name ?? u.email, searchText: u.email }))}
            value={form.responsibleId}
            onChange={id => setForm({ ...form, responsibleId: id })}
            placeholder="— None —"
            searchPlaceholder="Search users…"
            emptyMessage="No users match."
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <label className="text-sm font-medium text-foreground">Notes</label>
          <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Optional notes…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>
        <div className="col-span-2 flex items-start gap-2">
          <input
            id="autoRenew-admin"
            type="checkbox"
            checked={form.autoRenew}
            onChange={e => setForm({ ...form, autoRenew: e.target.checked })}
            className="mt-0.5 size-4 rounded border-border"
          />
          <label htmlFor="autoRenew-admin" className="text-sm text-foreground">
            Auto-renews with vendor
            <span className="block text-xs text-muted-foreground">Skip reminder emails — the vendor renews this automatically.</span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default function AdminSubscriptionsPage() {
  const [subs, setSubs]         = useState<Sub[]>([])
  const [vendors, setVendors]   = useState<Vendor[]>([])
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<Sub | null>(null)
  const [deleting, setDeleting] = useState<Sub | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [form, setForm]         = useState<FormData>(emptyForm())
  const [editForm, setEditForm] = useState<FormData>(emptyForm())

  const load = useCallback(async () => {
    setLoading(true)
    const [s, v, u] = await Promise.all([
      fetch("/api/admin/subscriptions").then(r => r.json()),
      fetch("/api/admin/vendors").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()),
    ])
    setSubs(s); setVendors(v); setUsers(u); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function dollarsToCents(val: string) { return Math.round(parseFloat(val || "0") * 100) }

  async function handleAdd() {
    setSaving(true); setError(null)
    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, cost: dollarsToCents(form.cost), responsibleId: form.responsibleId || null }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setShowAdd(false); setForm(emptyForm()); load()
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/subscriptions/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, cost: dollarsToCents(editForm.cost), responsibleId: editForm.responsibleId || null }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setEditing(null); load()
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/subscriptions/${deleting.id}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setDeleting(null); load()
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">All Subscriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, edit, and delete company subscriptions.</p>
        </div>
        <Button onClick={() => { setError(null); setForm(emptyForm()); setShowAdd(true) }} className="self-start sm:self-auto">
          <RiAddLine className="size-4" data-icon="inline-start" />New Subscription
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="hidden md:block">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Cost</th>
                <th className="hidden xl:table-cell px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Cycle</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Renewal</th>
                <th className="hidden xl:table-cell px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Responsible</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground"><RiLoader4Line className="size-5 animate-spin inline" /></td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No subscriptions yet.</td></tr>
              ) : subs.map(s => (
                <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 xl:px-6 py-3.5">
                    <p className="font-medium text-foreground truncate flex items-center gap-1.5">
                      {s.vendor.name}
                      {s.autoRenew && (
                        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0">Auto</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{s.planName}</p>
                  </td>
                  <td className="px-4 xl:px-6 py-3.5">
                    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", STATUS_COLORS[s.status])}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 xl:px-6 py-3.5 font-medium text-foreground">{fmt(s.cost)}</td>
                  <td className="hidden xl:table-cell px-4 xl:px-6 py-3.5 text-muted-foreground">{CYCLE_LABELS[s.billingCycle] ?? s.billingCycle}</td>
                  <td className="px-4 xl:px-6 py-3.5 text-muted-foreground">{fmtDate(s.renewalDate)}</td>
                  <td className="hidden xl:table-cell px-4 xl:px-6 py-3.5 text-muted-foreground truncate">{s.responsible?.name ?? s.responsible?.email ?? <span className="opacity-40">—</span>}</td>
                  <td className="px-4 xl:px-6 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon-sm" onClick={() => {
                        setEditing(s)
                        setEditForm({
                          vendorId: s.vendor.id, planName: s.planName,
                          cost: (s.cost / 100).toFixed(2),
                          billingCycle: s.billingCycle, startDate: toInput(s.startDate),
                          renewalDate: toInput(s.renewalDate), status: s.status,
                          responsibleId: s.responsible?.id ?? "", notes: s.notes ?? "",
                          autoRenew: s.autoRenew,
                        })
                        setError(null)
                      }}>
                        <RiEditLine className="size-4" />
                      </Button>
                      <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(s); setError(null) }}>
                        <RiDeleteBinLine className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card list (mobile) */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><RiLoader4Line className="size-5 animate-spin inline" /></div>
          ) : subs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No subscriptions yet.</div>
          ) : subs.map(s => (
            <div key={s.id} className="px-4 py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                    {s.vendor.name}
                    {s.autoRenew && (
                      <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 shrink-0">Auto</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{s.planName}</div>
                </div>
                <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium shrink-0", STATUS_COLORS[s.status])}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Cost</div>
                  <div className="font-medium text-foreground">{fmt(s.cost)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Cycle</div>
                  <div className="text-foreground">{CYCLE_LABELS[s.billingCycle] ?? s.billingCycle}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Renewal</div>
                  <div className="text-foreground">{fmtDate(s.renewalDate)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Responsible</div>
                  <div className="text-foreground truncate">{s.responsible?.name ?? s.responsible?.email ?? "—"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditing(s)
                  setEditForm({
                    vendorId: s.vendor.id, planName: s.planName,
                    cost: (s.cost / 100).toFixed(2),
                    billingCycle: s.billingCycle, startDate: toInput(s.startDate),
                    renewalDate: toInput(s.renewalDate), status: s.status,
                    responsibleId: s.responsible?.id ?? "", notes: s.notes ?? "",
                    autoRenew: s.autoRenew,
                  })
                  setError(null)
                }} className="flex-1">
                  <RiEditLine className="size-4" data-icon="inline-start" />Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => { setDeleting(s); setError(null) }}>
                  <RiDeleteBinLine className="size-4" data-icon="inline-start" />Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3 md:px-6 text-xs text-muted-foreground">{subs.length} subscription{subs.length !== 1 ? "s" : ""}</div>
      </div>

      {showAdd && (
        <Modal title="New Subscription" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <SubForm form={form} setForm={setForm} vendors={vendors} users={users} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Creating…</> : "Create Subscription"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit: ${editing.vendor.name} — ${editing.planName}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <SubForm form={editForm} setForm={setEditForm} vendors={vendors} users={users} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Delete Subscription" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <p className="text-sm text-muted-foreground">
              Delete <strong className="text-foreground">{deleting.vendor.name} — {deleting.planName}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                {saving ? <RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" /> : null}Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
