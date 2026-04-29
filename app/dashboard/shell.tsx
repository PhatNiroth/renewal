"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiHome5Line, RiStackLine,
  RiSettings3Line, RiMenuLine, RiCloseLine, RiSunLine,
  RiMoonLine, RiBuildingLine, RiLogoutBoxLine,
} from "@remixicon/react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { logout } from "@/app/actions/auth"
import type { Session } from "@/lib/auth"

const navItems = [
  { href: "/dashboard",              label: "Overview",      icon: RiHome5Line    },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: RiStackLine    },
  { href: "/dashboard/vendors",      label: "Vendors",       icon: RiBuildingLine },
]


export default function DashboardShell({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  const pathname      = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("theme")
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
    setDark(isDark)
  }, [])

  const toggleTheme = () => {
    const next = !(dark ?? document.documentElement.classList.contains("dark"))
    setDark(next)
    localStorage.setItem("theme", next ? "dark" : "light")
    document.documentElement.classList.toggle("dark", next)
  }

  const { name, email, isAdmin } = session.user
  const userName = name || email
  const userRole = isAdmin ? "Admin" : "Staff"
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary">
            <RiStackLine className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground tracking-tight">Krawma Renewal</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <RiCloseLine />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="px-3 pb-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
            Menu
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (
              href !== "/dashboard" && pathname.startsWith(href)
            )
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            )
          })}

        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {isAdmin && (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <RiSettings3Line className="size-4 shrink-0" />
              Settings
            </Link>
          )}

          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground leading-none">{userName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60 mt-0.5">{userRole}</p>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="cursor-pointer flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <RiLogoutBoxLine className="size-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <RiMenuLine />
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleTheme}
              title={dark === true ? "Switch to light mode" : "Switch to dark mode"}
              className="cursor-pointer"
            >
              {dark === true ? <RiSunLine /> : <RiMoonLine />}
            </Button>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
              <div className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">{email}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
