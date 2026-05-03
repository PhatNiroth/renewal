import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DashboardShell from "./shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect(`${process.env.NEXT_PUBLIC_AUTH_URL}/login`)

  return (
    <DashboardShell session={session}>
      {children}
    </DashboardShell>
  )
}
