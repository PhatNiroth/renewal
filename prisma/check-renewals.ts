import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const in30days = new Date()
  in30days.setDate(in30days.getDate() + 30)
  console.log("30-day cutoff:", in30days.toISOString())

  const subs = await db.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "EXPIRING_SOON"] },
      renewalDate: { lte: in30days },
    },
    select: { planName: true, renewalDate: true, status: true },
  })

  console.log(`\nRenewals query returns ${subs.length} records:`)
  subs.forEach(s => console.log(" -", s.planName, "|", s.renewalDate.toLocaleDateString(), "|", s.status))
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
