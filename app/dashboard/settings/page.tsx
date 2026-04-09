"use client"

import { useState, useTransition, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  RiUserLine,
  RiLockLine,
  RiBellLine,
  RiCheckLine,
  RiLoader4Line,
} from "@remixicon/react"

type NotifPrefs = { renewal7d: boolean; renewal3d: boolean; renewal1d: boolean; renewalExpired: boolean }

const sections = [
  { id: "profile",       label: "Profile",       icon: RiUserLine },
  { id: "security",      label: "Security",       icon: RiLockLine },
  { id: "notifications", label: "Notifications",  icon: RiBellLine },
]

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileSection() {
  const { data: session, update } = useSession()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userName  = session?.user?.name ?? ""
  const userEmail = session?.user?.email ?? ""
  const u = session?.user as { isAdmin?: boolean; roleName?: string } | undefined
  const userRole  = u?.isAdmin ? "Admin" : (u?.roleName ?? "")

  function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd   = new FormData(e.currentTarget)
    const name = (fd.get("name") as string).trim()

    if (!name) { setError("Name cannot be empty"); return }

    startTransition(async () => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? "Failed to save")
        return
      }
      await update({ name })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Update your display name.</p>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Full Name</label>
        <Input name="name" defaultValue={userName} placeholder="Your name" required />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Email</label>
        <Input value={userEmail} disabled className="opacity-60 cursor-not-allowed" readOnly />
        <p className="text-xs text-muted-foreground">Email cannot be changed. Contact an admin.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Role</label>
        <div className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {userRole}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending
          ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</>
          : saved
            ? <><RiCheckLine data-icon="inline-start" />Saved</>
            : "Save Changes"}
      </Button>
    </form>
  )
}

// ─── Security ─────────────────────────────────────────────────────────────────

function SecuritySection() {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd      = new FormData(e.currentTarget)
    const current = fd.get("currentPassword") as string
    const next    = fd.get("newPassword") as string
    const confirm = fd.get("confirmPassword") as string

    if (next !== confirm) { setError("New passwords do not match"); return }
    if (next.length < 8)  { setError("Password must be at least 8 characters"); return }

    startTransition(async () => {
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? "Failed to update password")
        return
      }
      setSaved(true)
      ;(e.target as HTMLFormElement).reset()
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Security</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Change your password.</p>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Current Password</label>
        <Input name="currentPassword" type="password" placeholder="••••••••" required />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">New Password</label>
        <Input name="newPassword" type="password" placeholder="Min. 8 characters" minLength={8} required />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Confirm New Password</label>
        <Input name="confirmPassword" type="password" placeholder="Repeat new password" required />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending
          ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Updating…</>
          : saved
            ? <><RiCheckLine data-icon="inline-start" />Updated</>
            : "Update Password"}
      </Button>
    </form>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsSection() {
  const [prefs, setPrefs]   = useState<NotifPrefs>({ renewal7d: true, renewal3d: true, renewal1d: true, renewalExpired: false })
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/user/notifications")
      .then(r => r.json())
      .then((data: NotifPrefs) => { setPrefs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? "Failed to save")
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const items = [
    { key: "renewal7d"      as const, label: "7-day renewal reminder", desc: "Email when a subscription renews in 7 days" },
    { key: "renewal3d"      as const, label: "3-day renewal reminder", desc: "Email when a subscription renews in 3 days" },
    { key: "renewal1d"      as const, label: "1-day renewal reminder", desc: "Email when a subscription renews tomorrow"  },
    { key: "renewalExpired" as const, label: "Expiry notifications",   desc: "Email when a subscription has expired"      },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Choose which renewal alerts you receive.</p>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="space-y-3">
        {items.map(({ key, label, desc }) => (
          <label key={key} className={`flex items-start gap-3 ${loading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
              className="mt-0.5 size-4 rounded border-border accent-primary"
            />
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </label>
        ))}
      </div>

      <Button onClick={handleSave} disabled={isPending || loading}>
        {isPending
          ? <><RiLoader4Line className="size-4 animate-spin" data-icon="inline-start" />Saving…</>
          : saved
            ? <><RiCheckLine data-icon="inline-start" />Saved</>
            : "Save Preferences"}
      </Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const sectionComponents: Record<string, React.ComponentType> = {
  profile:       ProfileSection,
  security:      SecuritySection,
  notifications: NotificationsSection,
}

export default function SettingsPage() {
  const [active, setActive] = useState("profile")
  const ActiveSection = sectionComponents[active]

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account preferences.</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left nav */}
        <nav className="flex shrink-0 flex-col gap-1 lg:w-48">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                "cursor-pointer flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                active === id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-border bg-card p-6">
          <ActiveSection />
        </div>
      </div>
    </div>
  )
}
