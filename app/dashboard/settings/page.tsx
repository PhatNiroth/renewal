"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { RiBellLine, RiCheckLine, RiLoader4Line } from "@remixicon/react"

type GlobalNotifPrefs = {
  renewal7d: boolean
  renewal3d: boolean
  renewal1d: boolean
  renewalExpired: boolean
}

const ITEMS: { key: keyof GlobalNotifPrefs; label: string; desc: string }[] = [
  { key: "renewal7d",      label: "7-day renewal reminder",  desc: "Send email when a subscription renews in 7 days"  },
  { key: "renewal3d",      label: "3-day renewal reminder",  desc: "Send email when a subscription renews in 3 days"  },
  { key: "renewal1d",      label: "1-day renewal reminder",  desc: "Send email when a subscription renews tomorrow"   },
  { key: "renewalExpired", label: "Expiry notifications",    desc: "Send email when a subscription has expired"       },
]

export default function SettingsPage() {
  const [prefs, setPrefs]       = useState<GlobalNotifPrefs>({ renewal7d: true, renewal3d: true, renewal1d: true, renewalExpired: false })
  const [loading, setLoading]   = useState(true)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/notifications")
      .then(r => r.json())
      .then((data: GlobalNotifPrefs) => { setPrefs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await fetch("/api/admin/notifications", {
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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Global notification preferences for all renewal alerts.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 md:p-6 max-w-lg space-y-5">
        <div className="flex items-center gap-2">
          <RiBellLine className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Notifications</h2>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}

        <div className="space-y-3">
          {ITEMS.map(({ key, label, desc }) => (
            <label
              key={key}
              className={`flex items-start gap-3 ${loading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
            >
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
    </div>
  )
}
