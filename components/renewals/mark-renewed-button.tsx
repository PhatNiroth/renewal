"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RiCheckLine, RiLoader4Line } from "@remixicon/react"
import { markAsRenewed } from "@/app/actions/subscriptions"

export function MarkRenewedButton({ subscriptionId }: { subscriptionId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await markAsRenewed(subscriptionId)
    setLoading(false)
    if ("error" in result) {
      setError(result.error)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <RiCheckLine className="size-3.5" /> Renewed
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading
          ? <RiLoader4Line className="size-3.5 animate-spin" data-icon="inline-start" />
          : <RiCheckLine className="size-3.5" data-icon="inline-start" />}
        {loading ? "Saving…" : "Mark Renewed"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
