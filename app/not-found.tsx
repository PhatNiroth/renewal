"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RiHome4Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"

const HOME = "/dashboard"
const SECONDS = 10

export default function NotFound() {
  const router = useRouter()
  const [count, setCount] = useState(SECONDS)

  useEffect(() => {
    if (count <= 0) { router.push(HOME); return }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <p className="text-8xl font-bold text-foreground">404</p>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          Redirecting to home in{" "}
          <span className="font-medium text-foreground">{count}s</span>
          …
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{ width: `${((SECONDS - count) / SECONDS) * 100}%` }}
        />
      </div>

      <Button onClick={() => router.push(HOME)}>
        <RiHome4Line data-icon="inline-start" />
        Go home
      </Button>
    </div>
  )
}
