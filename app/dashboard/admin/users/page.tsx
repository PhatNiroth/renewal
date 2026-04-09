"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
import { Modal } from "@/components/ui/modal"

type Role = { id: string; name: string }
type User = {
  id: string; name: string | null; email: string; isAdmin: boolean
  roleId: string | null; role: Role | null; createdAt: string
  _count: { responsibleFor: number }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}


export default function AdminUsersPage() {
  const [users, setUsers]       = useState<User[]>([])
  const [roles, setRoles]       = useState<Role[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "", isAdmin: false })
  const [editForm, setEditForm] = useState({ name: "", roleId: "", isAdmin: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, r] = await Promise.all([
        fetch("/api/admin/users").then(r => r.json()),
        fetch("/api/admin/roles").then(r => r.json()),
      ])
      setUsers(Array.isArray(u) ? u : [])
      setRoles(Array.isArray(r) ? r : [])
    } catch {
      setUsers([]); setRoles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    setSaving(true); setError(null)
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, roleId: form.roleId || null }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setShowAdd(false)
    setForm({ name: "", email: "", password: "", roleId: "", isAdmin: false })
    load()
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, roleId: editForm.roleId || null, isAdmin: editForm.isAdmin }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setEditing(null); load()
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/users/${deleting.id}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); return }
    setDeleting(null); load()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage staff accounts and role assignments.</p>
        </div>
        <Button onClick={() => { setError(null); setForm({ name: "", email: "", password: "", roleId: "", isAdmin: false }); setShowAdd(true) }}>
          <RiAddLine className="size-4" data-icon="inline-start" />New User
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Subs.</th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground"><RiLoader4Line className="size-5 animate-spin inline" /></td></tr>
              ) : users.map(u => {
                const initials = (u.name ?? u.email).slice(0, 2).toUpperCase()
                return (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{initials}</div>
                        <div>
                          <p className="font-medium text-foreground">{u.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {u.isAdmin
                        ? <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Admin</span>
                        : u.role
                          ? <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{u.role.name}</span>
                          : <span className="text-muted-foreground/50 text-xs">No role</span>}
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground">{u._count.responsibleFor}</td>
                    <td className="px-6 py-3.5 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon-sm" onClick={() => {
                          setEditing(u)
                          setEditForm({ name: u.name ?? "", roleId: u.roleId ?? "", isAdmin: u.isAdmin })
                          setError(null)
                        }}>
                          <RiEditLine className="size-4" />
                        </Button>
                        <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(u); setError(null) }}>
                          <RiDeleteBinLine className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
          {users.length} user{users.length !== 1 ? "s" : ""} total
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="New User" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email <span className="text-destructive">*</span></label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password <span className="text-destructive">*</span></label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select
                value={form.roleId}
                onChange={e => setForm({ ...form, roleId: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— No role —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isAdmin} onChange={e => setForm({ ...form, isAdmin: e.target.checked })} className="size-4 rounded border-border accent-primary" />
              <span className="text-sm text-foreground">Grant admin access</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Creating…</> : "Create User"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Edit: ${editing.name ?? editing.email}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role</label>
              <select
                value={editForm.roleId}
                onChange={e => setEditForm({ ...editForm, roleId: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— No role —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.isAdmin} onChange={e => setEditForm({ ...editForm, isAdmin: e.target.checked })} className="size-4 rounded border-border accent-primary" />
              <span className="text-sm text-foreground">Grant admin access</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
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
        <Modal title="Delete User" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <p className="text-sm text-muted-foreground">
              Permanently delete <strong className="text-foreground">{deleting.name ?? deleting.email}</strong>? This cannot be undone.
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
