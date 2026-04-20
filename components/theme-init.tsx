"use client"

import { useEffect } from "react"

export function ThemeInit() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme")
      const isDark = stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
      if (isDark) document.documentElement.classList.add("dark")
    } catch {}
  }, [])

  return null
}
