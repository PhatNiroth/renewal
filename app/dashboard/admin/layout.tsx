"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const adminNav = [
  { href: "/dashboard/admin/users", label: "Users" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      {/* Admin sub-nav */}
      <div className="border-b border-border bg-muted/30 px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {adminNav.map(({ href, label }) => {
            const active =
              href === "/dashboard/admin"
                ? pathname === href
                : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}
