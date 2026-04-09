import { PrismaClient, BillingCycle, SubscriptionStatus } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const now = new Date()

  // Pick any existing vendor to attach subscriptions to
  const vendors = await db.vendor.findMany({ take: 5 })
  if (vendors.length === 0) {
    console.error("No vendors found — run the main seed first: npx prisma db seed")
    process.exit(1)
  }

  const v = (i: number) => vendors[i % vendors.length].id

  // These dates are all > 30 days out — will NOT appear on the Renewals page
  const in45  = new Date(now); in45.setDate(now.getDate() + 45)
  const in60  = new Date(now); in60.setDate(now.getDate() + 60)
  const in90  = new Date(now); in90.setDate(now.getDate() + 90)
  const in120 = new Date(now); in120.setDate(now.getDate() + 120)
  const in180 = new Date(now); in180.setDate(now.getDate() + 180)
  const in365 = new Date(now); in365.setFullYear(now.getFullYear() + 1)

  const dummies = [
    { vendorId: v(0), planName: "Pro Plan",              cost:  2900, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-01-01"), renewalDate: in45,  status: SubscriptionStatus.ACTIVE, notes: "Renews in 45 days — outside 30-day window" },
    { vendorId: v(1), planName: "Team Collaboration",    cost:  4900, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-02-01"), renewalDate: in60,  status: SubscriptionStatus.ACTIVE, notes: "Renews in 60 days" },
    { vendorId: v(2), planName: "Business Suite",        cost: 12000, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-03-01"), renewalDate: in90,  status: SubscriptionStatus.ACTIVE, notes: "Renews in 90 days" },
    { vendorId: v(3), planName: "Enterprise License",    cost: 49000, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-04-01"), renewalDate: in120, status: SubscriptionStatus.ACTIVE, notes: "Renews in 120 days" },
    { vendorId: v(4), planName: "Storage Add-on",        cost:  1500, billingCycle: BillingCycle.MONTHLY, startDate: new Date("2025-05-01"), renewalDate: in180, status: SubscriptionStatus.ACTIVE, notes: "Renews in 180 days" },
    { vendorId: v(0), planName: "Annual Support Plan",   cost: 99900, billingCycle: BillingCycle.YEARLY,  startDate: new Date("2025-06-01"), renewalDate: in365, status: SubscriptionStatus.ACTIVE, notes: "Renews next year" },
  ]

  for (const sub of dummies) {
    await db.subscription.create({ data: sub })
    console.log(`  ✓ ${sub.planName} — renews ${sub.renewalDate.toLocaleDateString()}`)
  }

  console.log(`\n${dummies.length} dummy subscriptions created (all outside the 30-day renewal window).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
