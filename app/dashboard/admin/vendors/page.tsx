"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiLoader4Line, RiCloseLine } from "@remixicon/react"
import { Modal } from "@/components/ui/modal"

type CategoryInfo = { id: string; name: string; slug: string; color: string }
type Vendor = {
  id: string; name: string; slug: string; category: CategoryInfo | null
  website: string | null; contactEmail: string | null; contactName: string | null
  notes: string | null; isActive: boolean; _count: { subscriptions: number }
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


type FormData = { name: string; categoryId: string; website: string; contactEmail: string; contactName: string; notes: string }
function emptyForm(): FormData { return { name: "", categoryId: "", website: "", contactEmail: "", contactName: "", notes: "" } }

const COLORS = [
  { value: "blue", label: "Blue" }, { value: "violet", label: "Violet" },
  { value: "amber", label: "Amber" }, { value: "emerald", label: "Emerald" },
  { value: "rose", label: "Rose" }, { value: "orange", label: "Orange" },
  { value: "cyan", label: "Cyan" }, { value: "gray", label: "Gray" },
]

function VendorForm({
  form, setForm, categories, onCategoryCreated,
}: {
  form: FormData
  setForm: (f: FormData) => void
  categories: CategoryInfo[]
  onCategoryCreated: (cat: CategoryInfo) => void
}) {
  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })

  const [showNew, setShowNew]     = useState(false)
  const [newName, setNewName]     = useState("")
  const [newColor, setNewColor]   = useState("gray")
  const [creating, setCreating]   = useState(false)
  const [catError, setCatError]   = useState<string | null>(null)

  async function handleCreateCategory() {
    if (!newName.trim()) { setCatError("Name is required"); return }
    setCreating(true); setCatError(null)
    const res = await fetch("/api/admin/vendor-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    setCreating(false)
    if (!res.ok) { const j = await res.json(); setCatError(j.error); return }
    const cat: CategoryInfo = await res.json()
    onCategoryCreated(cat)
    setForm({ ...form, categoryId: cat.id })
    setShowNew(false); setNewName(""); setNewColor("gray")
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Vendor Name <span className="text-destructive">*</span></label>
        <Input value={form.name} onChange={set("name")} placeholder="e.g. Salesforce" />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Category</label>
        <div className="flex gap-2">
          <select value={form.categoryId} onChange={set("categoryId")} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30">
            <option value="">— None —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button type="button" variant="outline" size="icon-sm" title="Create new category" onClick={() => { setShowNew(v => !v); setCatError(null) }}>
            {showNew ? <RiCloseLine className="size-4" /> : <RiAddLine className="size-4" />}
          </Button>
        </div>

        {showNew && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <p className="text-xs font-medium text-foreground">New category</p>
            {catError && <p className="text-xs text-destructive">{catError}</p>}
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Category name"
                className="flex-1 h-8 text-xs"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory() } }}
              />
              <select
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <Button type="button" size="sm" onClick={handleCreateCategory} disabled={creating} className="h-8 px-3 text-xs">
                {creating ? <RiLoader4Line className="size-3 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Website</label>
        <Input value={form.website} onChange={set("website")} placeholder="https://example.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Contact Name</label>
          <Input value={form.contactName} onChange={set("contactName")} placeholder="Account Manager" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Contact Email</label>
          <Input type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="contact@vendor.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Notes</label>
        <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Optional notes…" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
      </div>
    </div>
  )
}

export default function AdminVendorsPage() {
  const [vendors, setVendors]     = useState<Vendor[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState<Vendor | null>(null)
  const [deleting, setDeleting]   = useState<Vendor | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [form, setForm]           = useState<FormData>(emptyForm())
  const [editForm, setEditForm]   = useState<FormData>(emptyForm())

  const load = useCallback(async () => {
    setLoading(true)
    const [v, c] = await Promise.all([
      fetch("/api/admin/vendors").then(r => r.json()),
      fetch("/api/admin/vendor-categories").then(r => r.json()),
    ])
    setVendors(v); setCategories(c); setLoading(false)
  }, [])

  function handleCategoryCreated(cat: CategoryInfo) {
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
  }

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    setSaving(true); setError(null)
    const res = await fetch("/api/admin/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categoryId: form.categoryId || null }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setShowAdd(false); setForm(emptyForm()); load()
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/vendors/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, categoryId: editForm.categoryId || null }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setEditing(null); load()
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/vendors/${deleting.id}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setDeleting(null); load()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all vendor records.</p>
        </div>
        <Button onClick={() => { setError(null); setForm(emptyForm()); setShowAdd(true) }}>
          <RiAddLine className="size-4" data-icon="inline-start" />Add Vendor
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Contact</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Subs.</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground"><RiLoader4Line className="size-5 animate-spin inline" /></td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No vendors yet.</td></tr>
              ) : vendors.map(v => (
                <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="font-medium text-foreground">{v.name}</p>
                    {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{v.website}</a>}
                  </td>
                  <td className="px-6 py-3.5">
                    {v.category ? (
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorClass(v.category.color)}`}>
                        {v.category.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground opacity-40">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground">
                    {v.contactName && <p className="text-xs">{v.contactName}</p>}
                    {v.contactEmail && <p className="text-xs">{v.contactEmail}</p>}
                    {!v.contactName && !v.contactEmail && <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground">{v._count.subscriptions}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon-sm" onClick={() => {
                        setEditing(v)
                        setEditForm({ name: v.name, categoryId: v.category?.id ?? "", website: v.website ?? "", contactEmail: v.contactEmail ?? "", contactName: v.contactName ?? "", notes: v.notes ?? "" })
                        setError(null)
                      }}>
                        <RiEditLine className="size-4" />
                      </Button>
                      <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(v); setError(null) }}>
                        <RiDeleteBinLine className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</div>
      </div>

      {showAdd && (
        <Modal title="Add Vendor" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <VendorForm form={form} setForm={setForm} categories={categories} onCategoryCreated={handleCategoryCreated} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Add Vendor"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <VendorForm form={editForm} setForm={setEditForm} categories={categories} onCategoryCreated={handleCategoryCreated} />
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
        <Modal title="Delete Vendor" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <p className="text-sm text-muted-foreground">
              Delete <strong className="text-foreground">{deleting.name}</strong>?
              {deleting._count.subscriptions > 0 && (
                <span className="text-destructive"> This vendor has {deleting._count.subscriptions} subscription{deleting._count.subscriptions !== 1 ? "s" : ""} and cannot be deleted.</span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              {deleting._count.subscriptions === 0 && (
                <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                  {saving ? <RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" /> : null}Delete
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
