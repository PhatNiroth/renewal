import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const now = new Date()
  const in30days = new Date(now)
  in30days.setDate(now.getDate() + 30)

  const all = await db.subscription.findMany({
    select: { planName: true, renewalDate: true, status: true },
    orderBy: { renewalDate: "asc" },
  })

  console.log("All subscriptions:")
  all.forEach(s => {
    const days = Math.ceil((s.renewalDate.getTime() - now.getTime()) / 86_400_000)
    const inWindow = days <= 30 && (s.status === "ACTIVE" || s.status === "EXPIRING_SOON")
    console.log(` ${inWindow ? "✅ RENEWAL" : "❌ not in renewal"} | ${s.planName} | ${s.renewalDate.toLocaleDateString()} | ${days}d | ${s.status}`)
  })
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
