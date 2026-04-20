import Link from "next/link"
import { RiStackLine } from "@remixicon/react"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Link href="/login" className="mb-8 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
          <RiStackLine className="size-5 text-white" />
        </div>
        <span className="text-xl font-semibold tracking-tight text-foreground">Krawma Renewal</span>
      </Link>
      {children}
    </div>
  )
}
