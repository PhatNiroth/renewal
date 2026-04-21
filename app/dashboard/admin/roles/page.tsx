"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiLoader4Line } from "@remixicon/react"
import { Modal } from "@/components/ui/modal"

const MODULES = ["SUBSCRIPTIONS", "RENEWALS", "VENDORS", "VENDOR_CATEGORIES"] as const
type ModuleName = typeof MODULES[number]
type PermMap = Record<ModuleName, { view: boolean; add: boolean; edit: boolean; delete: boolean }>
const ACTIONS = ["view", "add", "edit", "delete"] as const

const MODULE_LABELS: Record<string, string> = {
  SUBSCRIPTIONS:    "Subscriptions",
  RENEWALS:         "Renewals",
  VENDORS:          "Vendors",
  VENDOR_CATEGORIES:"Vendor Categories",
}

function emptyPerms(): PermMap {
  return Object.fromEntries(
    MODULES.map(m => [m, { view: false, add: false, edit: false, delete: false }])
  ) as PermMap
}

function permsFromApi(permissions: any[]): PermMap {
  const map = emptyPerms()
  for (const p of permissions ?? []) {
    map[p.module as ModuleName] = { view: p.canView, add: p.canAdd, edit: p.canEdit, delete: p.canDelete }
  }
  return map
}

type Role = { id: string; name: string; createdAt: string; _count: { users: number }; permissions: any[] }


function PermGrid({ perms, onChange }: { perms: PermMap; onChange: (m: ModuleName, a: string, v: boolean) => void }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Module</th>
            {ACTIONS.map(a => (
              <th key={a} className="px-3 py-2.5 text-center font-medium text-muted-foreground capitalize w-16">{a}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {MODULES.map(mod => (
            <tr key={mod} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2.5 font-medium text-foreground">{MODULE_LABELS[mod]}</td>
              {ACTIONS.map(action => (
                <td key={action} className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={perms[mod][action as keyof PermMap[ModuleName]]}
                    onChange={e => onChange(mod, action, e.target.checked)}
                    className="size-4 rounded border-border accent-primary cursor-pointer"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function AdminRolesPage() {
  const [roles, setRoles]       = useState<Role[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<Role | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)
  const [saving, setSaving]     = useState(false)
  const [addError, setAddError]   = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [newName, setNewName]   = useState("")
  const [newPerms, setNewPerms] = useState<PermMap>(emptyPerms())
  const [editPerms, setEditPerms] = useState<PermMap>(emptyPerms())
  const [editName, setEditName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/roles")
      const data = await res.json()
      setRoles(Array.isArray(data) ? data : [])
    } catch {
      setRoles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function togglePerm(map: PermMap, setMap: (m: PermMap) => void, mod: ModuleName, action: string, val: boolean) {
    const updated = { ...map, [mod]: { ...map[mod], [action]: val } }
    if (action !== "view" && val) updated[mod].view = true
    if (action === "view" && !val) updated[mod] = { view: false, add: false, edit: false, delete: false }
    setMap(updated)
  }

  async function handleAdd() {
    if (!newName.trim()) { setAddError("Role name is required"); return }
    setSaving(true); setAddError(null)
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, permissions: newPerms }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setAddError(j.error); toast.error("Failed to create role"); return }
    toast.success("Role created"); setShowAdd(false); setNewName(""); setNewPerms(emptyPerms()); load()
  }

  async function handleEdit() {
    if (!editing) return
    setSaving(true); setEditError(null)
    const res = await fetch(`/api/admin/roles/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, permissions: editPerms }),
    })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setEditError(j.error); toast.error("Failed to save role"); return }
    toast.success("Role saved"); setEditing(null); load()
  }

  async function handleDelete() {
    if (!deleting) return
    setSaving(true); setDeleteError(null)
    const res = await fetch(`/api/admin/roles/${deleting.id}`, { method: "DELETE" })
    setSaving(false)
    if (!res.ok) { const j = await res.json(); setDeleteError(j.error); toast.error("Failed to delete role"); return }
    toast.success("Role deleted"); setDeleting(null); load()
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define roles and set their module permissions.</p>
        </div>
        <Button onClick={() => { setAddError(null); setNewName(""); setNewPerms(emptyPerms()); setShowAdd(true) }} className="self-start sm:self-auto">
          <RiAddLine className="size-4" data-icon="inline-start" />New Role
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="hidden md:block">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Role Name</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Users</th>
                <th className="hidden xl:table-cell px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Created</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Permissions</th>
                <th className="px-4 xl:px-6 py-3 text-left font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <RiLoader4Line className="size-5 animate-spin inline" />
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No roles yet.</td>
                </tr>
              ) : roles.map(role => {
                const perms = permsFromApi(role.permissions)
                return (
                  <tr key={role.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 xl:px-6 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-foreground truncate">{role.name}</p>
                      </div>
                    </td>
                    <td className="px-4 xl:px-6 py-4 text-muted-foreground">{role._count.users}</td>
                    <td className="hidden xl:table-cell px-4 xl:px-6 py-4 text-muted-foreground">{fmtDate(role.createdAt)}</td>
                    <td className="px-4 xl:px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {MODULES.map(mod => {
                          const p = perms[mod]
                          const actions = (["view","add","edit","delete"] as const).filter(a => p[a])
                          if (actions.length === 0) return (
                            <span key={mod} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground/50">
                              {MODULE_LABELS[mod]}: none
                            </span>
                          )
                          return (
                            <span key={mod} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                              {MODULE_LABELS[mod]}: {actions.join(", ")}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 xl:px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon-sm" onClick={() => {
                          setEditing(role)
                          setEditName(role.name)
                          setEditPerms(permsFromApi(role.permissions))
                          setEditError(null)
                        }}>
                          <RiEditLine className="size-4" />
                        </Button>
                        <Button variant="outline" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleting(role); setDeleteError(null) }}>
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
          ) : roles.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">No roles yet.</div>
          ) : roles.map(role => {
            const perms = permsFromApi(role.permissions)
            return (
              <div key={role.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{role.name}</div>
                    <div className="text-xs text-muted-foreground">{role._count.users} user{role._count.users !== 1 ? "s" : ""} · {fmtDate(role.createdAt)}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">Permissions</div>
                  <div className="flex flex-wrap gap-1">
                    {MODULES.map(mod => {
                      const p = perms[mod]
                      const actions = (["view","add","edit","delete"] as const).filter(a => p[a])
                      if (actions.length === 0) return (
                        <span key={mod} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground/50">
                          {MODULE_LABELS[mod]}: none
                        </span>
                      )
                      return (
                        <span key={mod} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {MODULE_LABELS[mod]}: {actions.join(", ")}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                    setEditing(role)
                    setEditName(role.name)
                    setEditPerms(permsFromApi(role.permissions))
                    setEditError(null)
                  }}>
                    <RiEditLine className="size-4" data-icon="inline-start" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => { setDeleting(role); setDeleteError(null) }}>
                    <RiDeleteBinLine className="size-4" data-icon="inline-start" />Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-border px-4 py-3 md:px-6 text-xs text-muted-foreground">
          {roles.length} role{roles.length !== 1 ? "s" : ""} total
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="New Role" onClose={() => setShowAdd(false)}>
          <div className="space-y-5">
            {addError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{addError}</div>}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role Name <span className="text-destructive">*</span></label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Finance Manager" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Module Permissions</label>
              <PermGrid perms={newPerms} onChange={(m, a, v) => togglePerm(newPerms, setNewPerms, m, a, v)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Creating…</> : "Create Role"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Edit Role`} onClose={() => setEditing(null)}>
          <div className="space-y-5">
            {editError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{editError}</div>}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Role Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Module Permissions</label>
              <PermGrid perms={editPerms} onChange={(m, a, v) => togglePerm(editPerms, setEditPerms, m, a, v)} />
            </div>
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
        <Modal title="Delete Role" onClose={() => setDeleting(null)}>
          <div className="space-y-4">
            {deleteError && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{deleteError}</div>}
            <p className="text-sm text-muted-foreground">
              Delete role <strong className="text-foreground">{deleting.name}</strong>? This cannot be undone.
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
