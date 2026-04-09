import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

function fmt(n: number) {
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}


export default async function AdminPage() {
  const session = await auth()
  if (!session?.user || !(session.user as any).isAdmin) redirect("/dashboard")
  redirect("/dashboard/admin/roles")
}
