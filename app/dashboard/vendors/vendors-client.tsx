"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-hot-toast"
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiLoader4Line, RiCheckLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Modal } from "@/components/ui/modal"
import { createVendor, updateVendor } from "@/app/actions/vendors"

type CategoryInfo = { id: string; name: string; slug: string; color: string }

type VendorRow = {
  id: string
  name: string
  slug: string
  category: CategoryInfo | null
  website: string | null
  contactEmail: string | null
  contactName: string | null
  notes: string | null
  paymentMethod: string | null
  isActive: boolean
  _count: { subscriptions: number }
}

const COLOR_CLASSES: Record<string, string> = {
  blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  orange:  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  cyan:    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  gray:    "bg-muted text-muted-foreground",
}
function colorClass(color: string) { return COLOR_CLASSES[color] ?? COLOR_CLASSES.gray }

// ─── Vendor form fields ───────────────────────────────────────────────────────

function VendorFields({ categories, defaults }: { categories: CategoryInfo[]; defaults?: Partial<VendorRow> }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Vendor Name <span className="text-destructive">*</span></label>
        <Input name="name" defaultValue={defaults?.name ?? ""} placeholder="e.g. Anthropic" required />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Category</label>
        <select name="categoryId" defaultValue={defaults?.category?.id ?? ""} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">— None —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Website</label>
        <Input name="website" type="text" defaultValue={defaults?.website ?? ""} placeholder="e.g. www.example.com or https://example.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Contact Name</label>
          <Input name="contactName" defaultValue={defaults?.contactName ?? ""} placeholder="John Smith" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Contact Email</label>
          <Input name="contactEmail" type="email" defaultValue={defaults?.contactEmail ?? ""} placeholder="support@…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Payment Method</label>
        <Input name="paymentMethod" defaultValue={defaults?.paymentMethod ?? ""} placeholder="e.g. Credit Card, Bank Transfer, Invoice" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Notes</label>
        <textarea name="notes" rows={2} defaultValue={defaults?.notes ?? ""} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Optional notes…" />
      </div>
    </div>
  )
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function AddModal({ categories, onClose, onSuccess }: { categories: CategoryInfo[]; onClose: () => void; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createVendor(formData)
      if ("error" in result) { setError(result.error); toast.error("Failed to add vendor"); return }
      toast.success("Vendor added"); onSuccess(); onClose()
    })
  }

  return (
    <Modal title="New Vendor" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <VendorFields categories={categories} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : <><RiAddLine data-icon="inline-start" />Add Vendor</>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({ vendor, categories, onClose, onSuccess }: { vendor: VendorRow; categories: CategoryInfo[]; onClose: () => void; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateVendor(vendor.id, formData)
      if ("error" in result) { setError(result.error); toast.error("Failed to update vendor"); return }
      toast.success("Vendor updated"); onSuccess(); onClose()
    })
  }

  return (
    <Modal title={`Edit: ${vendor.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <VendorFields categories={categories} defaults={vendor} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : <><RiCheckLine data-icon="inline-start" />Save Changes</>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ vendor, onClose, onSuccess }: { vendor: VendorRow; onClose: () => void; onSuccess: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/vendors/${vendor.id}`, { method: "DELETE" })
      if (!res.ok) { const j = await res.json(); setError(j.error); toast.error("Failed to delete vendor"); return }
      toast.success("Vendor deleted"); onSuccess(); onClose()
    })
  }

  return (
    <Modal title="Delete Vendor" onClose={onClose}>
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <p className="text-sm text-muted-foreground">
          Delete <strong className="text-foreground">{vendor.name}</strong>?
          {vendor._count.subscriptions > 0 && (
            <span className="text-destructive"> This vendor has {vendor._count.subscriptions} subscription{vendor._count.subscriptions !== 1 ? "s" : ""} and cannot be deleted.</span>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {vendor._count.subscriptions === 0 && (
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" /> : null}Delete
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VendorsClient({
  vendors,
  categories,
  canAdd,
  canEdit,
  canDelete,
}: {
  vendors: VendorRow[]
  categories: CategoryInfo[]
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [showAdd, setShowAdd]       = useState(false)
  const [editing, setEditing]       = useState<VendorRow | null>(null)
  const [deleting, setDeleting]     = useState<VendorRow | null>(null)

  function reload() { router.refresh() }

  return (
    <>
      {showAdd  && <AddModal    categories={categories} onClose={() => setShowAdd(false)} onSuccess={reload} />}
      {editing  && <EditModal   vendor={editing}  categories={categories} onClose={() => setEditing(null)}  onSuccess={reload} />}
      {deleting && <DeleteModal vendor={deleting} onClose={() => setDeleting(null)} onSuccess={reload} />}

      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">Vendors</h1>
            <p className="mt-1 text-sm text-muted-foreground">External service providers and contract partners.</p>
          </div>
          {canAdd && (
            <Button onClick={() => setShowAdd(true)}>
              <RiAddLine className="size-4" data-icon="inline-start" />New Vendor
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Website</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Contact</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Payment Method</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Subs.</th>
                  {(canEdit || canDelete) && <th className="px-6 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit || canDelete ? 6 : 5} className="py-12 text-center text-sm text-muted-foreground">
                      No vendors yet.{canAdd ? " Click \"New Vendor\" to add one." : ""}
                    </td>
                  </tr>
                ) : vendors.map(v => (
                  <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                          {v.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{v.name}</p>
                          <span className={cn(
                            "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
                            v.isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                          )}>
                            {v.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {v.category ? (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorClass(v.category.color)}`}>
                          {v.category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {v.website ? (
                        <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate max-w-40 block">
                          {v.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground">
                      {v.contactName && <p className="text-xs">{v.contactName}</p>}
                      {v.contactEmail && <p className="text-xs">{v.contactEmail}</p>}
                      {!v.contactName && !v.contactEmail && <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground">{v.paymentMethod ?? <span className="opacity-40">—</span>}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{v._count.subscriptions}</td>
                    {(canEdit || canDelete) && (
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <Button variant="outline" size="icon-sm" onClick={() => setEditing(v)}>
                              <RiEditLine className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => setDeleting(v)}>
                              <RiDeleteBinLine className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </>
  )
}
