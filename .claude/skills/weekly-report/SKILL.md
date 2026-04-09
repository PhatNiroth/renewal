---
name: weekly-report
description: Generate a plain-English weekly procurement summary using the Analytics agent. Shows subscription health, upcoming renewals, spend breakdown, and recommended focus for the week.
disable-model-invocation: false
---

# Weekly Report

Generate a weekly subscription analytics summary using the Analytics agent.

## Instructions

1. Confirm the dev server is running at `http://localhost:3000` by checking with a quick curl

2. Query the database directly using Prisma to collect metrics. Create `__temp_report.ts`, run with `npx tsx __temp_report.ts`, then delete it:

```typescript
import { db } from "./lib/db"
import { generateAnalyticsSummary } from "./agents"

const now = new Date()
const startOfYear = new Date(now.getFullYear(), 0, 1)
const in7Days = new Date(now.getTime() + 7 * 86400000)
const in30Days = new Date(now.getTime() + 30 * 86400000)

// Gather metrics
const [allSubs, payments] = await Promise.all([
  db.subscription.findMany({
    include: { vendor: { include: { category: true } } },
  }),
  db.payment.findMany({
    where: { paidAt: { gte: startOfYear } },
  }),
])

const activeSubs = allSubs.filter(s => ["ACTIVE", "EXPIRING_SOON"].includes(s.status))
const expiringIn7 = allSubs.filter(s => s.renewalDate <= in7Days && s.renewalDate >= now && s.status === "ACTIVE")
const expiringIn30 = allSubs.filter(s => s.renewalDate <= in30Days && s.renewalDate >= now && s.status === "ACTIVE")
const expiredUnattended = allSubs.filter(s => s.status === "EXPIRED")
const cancelledCount = allSubs.filter(s => s.status === "CANCELLED").length

// Calculate monthly spend (normalize to monthly)
const cycleMultiplier: Record<string, number> = { MONTHLY: 1, QUARTERLY: 1/3, YEARLY: 1/12, ONE_TIME: 0 }
const estimatedMonthlySpend = activeSubs.reduce((sum, s) => sum + s.cost * (cycleMultiplier[s.billingCycle] ?? 0), 0)

// Renewal exposure
const renewalExposure7 = expiringIn7.reduce((sum, s) => sum + s.cost, 0)
const renewalExposure30 = expiringIn30.reduce((sum, s) => sum + s.cost, 0)

// Payments this year
const totalPaidThisYear = payments.reduce((sum, p) => sum + p.amount, 0)
const totalPaidAllTime = (await db.payment.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0

// Category breakdown
const categoryMap = new Map<string, { count: number; monthlySpend: number }>()
for (const s of activeSubs) {
  const cat = s.vendor.category?.name ?? "OTHER"
  const existing = categoryMap.get(cat) ?? { count: 0, monthlySpend: 0 }
  categoryMap.set(cat, {
    count: existing.count + 1,
    monthlySpend: existing.monthlySpend + s.cost * (cycleMultiplier[s.billingCycle] ?? 0),
  })
}

// Top vendors
const vendorMap = new Map<string, { monthlySpend: number; count: number }>()
for (const s of activeSubs) {
  const name = s.vendor.name
  const existing = vendorMap.get(name) ?? { monthlySpend: 0, count: 0 }
  vendorMap.set(name, {
    monthlySpend: existing.monthlySpend + s.cost * (cycleMultiplier[s.billingCycle] ?? 0),
    count: existing.count + 1,
  })
}
const topVendors = [...vendorMap.entries()]
  .sort((a, b) => b[1].monthlySpend - a[1].monthlySpend)
  .slice(0, 5)
  .map(([vendorName, v]) => ({ vendorName, ...v }))

const periodLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

// Generate AI summary
const summary = await generateAnalyticsSummary({
  totalSubscriptions: allSubs.length,
  activeSubscriptions: activeSubs.length,
  expiringIn7Days: expiringIn7.length,
  expiringIn30Days: expiringIn30.length,
  expiredUnattended: expiredUnattended.length,
  cancelledCount,
  estimatedMonthlySpend: Math.round(estimatedMonthlySpend),
  estimatedYearlySpend: Math.round(estimatedMonthlySpend * 12),
  totalPaidThisYear,
  totalPaidAllTime,
  renewalExposure7Days: renewalExposure7,
  renewalExposure30Days: renewalExposure30,
  categoryBreakdown: [...categoryMap.entries()].map(([category, v]) => ({ category, ...v, monthlySpend: Math.round(v.monthlySpend) })),
  topVendors: topVendors.map(v => ({ ...v, monthlySpend: Math.round(v.monthlySpend) })),
  periodLabel,
})

console.log("=== WEEKLY REPORT:", periodLabel.toUpperCase(), "===")
console.log("\nHeadline:", summary.headline)
console.log("Health Score:", summary.healthScore + "/100")
console.log("Spend Trend:", summary.spendTrend)
console.log("\nSummary:", summary.summary)
if (summary.alerts.length > 0) {
  console.log("\n⚠ ALERTS:")
  summary.alerts.forEach(a => console.log(" -", a))
}
if (summary.positives.length > 0) {
  console.log("\n✓ POSITIVES:")
  summary.positives.forEach(p => console.log(" -", p))
}
console.log("\n📌 RECOMMENDED FOCUS:", summary.recommendedFocus)
if (summary.costInsights.length > 0) {
  console.log("\n💰 COST INSIGHTS:")
  summary.costInsights.forEach(c => console.log(" -", c))
}

await db.$disconnect()
```

3. Present the report in a clean, readable format.

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Requires database to be running (PostgreSQL on port 5436)
- Clean up `__temp_report.ts` after running
