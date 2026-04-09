"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
import { Modal } from "@/components/ui/modal"

type Category = {
  id: string
  name: string
  slug: string
  color: string
  createdAt: string
  _count: { vendors: number }
}

const COLORS = [
  { value: "blue",    label: "Blue"    },
  { value: "violet",  label: "Violet"  },
  { value: "amber",   label: "Amber"   },
  { value: "emerald", label: "Emerald" },
  { value: "rose",    label: "Rose"    },
  { value: "orange",  label: "Orange"  },
  { value: "cyan",    label: "Cyan"    },
  { value: "gray",    label: "Gray"    },
]

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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}


function ColorDot({ color }: { color: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${COLOR_CLASSES[color] ?? COLOR_CLASSES.gray}`}>
      {COLORS.find(c => c.value === color)?.label ?? color}
    </span>
  )
}

function CategoryForm({
  name, setName, color, setColor,
}: { name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Category Name <span className="text-destructive">*</span></label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SaaS" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Badge Color</label>
        <select
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        >
          {COLORS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <div className="pt-1">
          <ColorDot color={color} />
        </div>
      </div>
    </div>
  )
}

export default function AdminVendorCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [editing, setEditing]       = useState<Category | null>(null)
  const [deleting, setDeleting]     = useState<Category | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [newName, setNewName]   = useState("")
  const [newColor, setNewColor] = useState("gray")
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("gray")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/vendor-categories")
    setCategories(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!newName.trim()) { setError("Name is required"); return }
    setSaving(true); setError(null)
    const res = await fetch("/api/admin/vendor-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setShowAdd(false); setNewName(""); setNewColor("gray"); load()
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/vendor-categories/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setEditing(null); load()
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/vendor-categories/${deleting.id}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setDeleting(null); load()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Vendor Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the categories used to classify vendors.</p>
        </div>
        <Button onClick={() => { setError(null); setNewName(""); setNewColor("gray"); setShowAdd(true) }}>
          <RiAddLine className="size-4" data-icon="inline-start" />New Category
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Color</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Vendors</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <RiLoader4Line className="size-5 animate-spin inline" />
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No categories yet.</td>
                </tr>
              ) : categories.map(cat => (
                <tr key={cat.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">{cat.name}</td>
                  <td className="px-6 py-4"><ColorDot color={cat.color} /></td>
                  <td className="px-6 py-4 text-muted-foreground">{cat._count.vendors}</td>
                  <td className="px-6 py-4 text-muted-foreground">{fmtDate(cat.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon-sm" onClick={() => {
                        setEditing(cat); setEditName(cat.name); setEditColor(cat.color); setError(null)
                      }}>
                        <RiEditLine className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setDeleting(cat); setError(null) }}
                      >
                        <RiDeleteBinLine className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
          {categories.length} categor{categories.length !== 1 ? "ies" : "y"} total
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="New Category" onClose={() => setShowAdd(false)}>
          <div className="space-y-5">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <CategoryForm name={newName} setName={setNewName} color={newColor} setColor={setNewColor} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Create Category"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Edit Category" onClose={() => setEditing(null)}>
          <div className="space-y-5">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <CategoryForm name={editName} setName={setEditName} color={editColor} setColor={setEditColor} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</> : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleting && (
        <Modal title="Delete Category" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <p className="text-sm text-muted-foreground">
              Delete <strong className="text-foreground">{deleting.name}</strong>?
              {deleting._count.vendors > 0 && (
                <span className="text-destructive"> {deleting._count.vendors} vendor{deleting._count.vendors !== 1 ? "s" : ""} use this category and it cannot be deleted.</span>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              {deleting._count.vendors === 0 && (
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
