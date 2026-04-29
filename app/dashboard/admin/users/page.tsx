"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { RiDeleteBinLine, RiLoader4Line, RiShieldLine } from "@remixicon/react"
import { Modal } from "@/components/ui/modal"

type User = {
  id: string; name: string | null; email: string; isAdmin: boolean
  createdAt: string; _count: { responsibleFor: number }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function AdminUsersPage() {
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const u = await fetch("/api/admin/users").then(r => r.json())
      setUsers(Array.isArray(u) ? u : [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleAdmin(u: User) {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !u.isAdmin }),
    })
    if (!res.ok) { toast.error("Failed to update user"); return }
    toast.success(u.isAdmin ? "Admin removed" : "Admin granted")
    load()
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true); setError(null)
    const res = await fetch(`/api/admin/users/${deleting.id}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setError(j.error); toast.error("Failed to delete user"); return }
    toast.success("User deleted"); setDeleting(null); load()
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Users are managed by dashboard.krawma.com. Here you can view access and toggle admin rights.</p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="hidden md:block">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Subs.</th>
                <th className="hidden xl:table-cell px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground"><RiLoader4Line className="size-5 animate-spin inline" /></td></tr>
              ) : users.map(u => {
                const initials = (u.name ?? u.email).slice(0, 2).toUpperCase()
                return (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 xl:px-6 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{initials}</div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{u.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 xl:px-6 py-3.5">
                      {u.isAdmin
                        ? <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Admin</span>
                        : <span className="text-muted-foreground/50 text-xs">User</span>}
                    </td>
                    <td className="px-4 xl:px-6 py-3.5 text-muted-foreground">{u._count.responsibleFor}</td>
                    <td className="hidden xl:table-cell px-4 xl:px-6 py-3.5 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 xl:px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon-sm" title={u.isAdmin ? "Remove admin" : "Grant admin"} onClick={() => toggleAdmin(u)}>
                          <RiShieldLine className="size-4" />
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

        {/* Card list (mobile) */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><RiLoader4Line className="size-5 animate-spin inline" /></div>
          ) : users.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No users yet.</div>
          ) : users.map(u => {
            const initials = (u.name ?? u.email).slice(0, 2).toUpperCase()
            return (
              <div key={u.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{initials}</div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{u.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </div>
                  {u.isAdmin
                    ? <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive shrink-0">Admin</span>
                    : <span className="text-muted-foreground/50 text-xs shrink-0">User</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div><div className="text-muted-foreground">Subscriptions</div><div className="text-foreground">{u._count.responsibleFor}</div></div>
                  <div><div className="text-muted-foreground">Joined</div><div className="text-foreground">{fmtDate(u.createdAt)}</div></div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => toggleAdmin(u)} className="flex-1">
                    <RiShieldLine className="size-4" data-icon="inline-start" />{u.isAdmin ? "Remove Admin" : "Grant Admin"}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => { setDeleting(u); setError(null) }}>
                    <RiDeleteBinLine className="size-4" data-icon="inline-start" />Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-border px-4 py-3 md:px-6 text-xs text-muted-foreground">
          {users.length} user{users.length !== 1 ? "s" : ""} total
        </div>
      </div>

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
