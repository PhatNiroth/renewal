---
name: spend-report
description: Run the Spend Optimization agent on the full subscription portfolio and surface cost-saving opportunities — yearly savings, vendor consolidation, unused subs, upcoming renegotiations.
---

# Spend Report

Run the Spend Optimization agent on the current subscription portfolio.

## Instructions

1. Create `__temp_spend.ts`, run with `npx tsx __temp_spend.ts`, then delete it:

```typescript
import { db } from "./lib/db"
import { analyzeSpend } from "./agents/business/spend-optimization.agent"

const now = new Date()
const subs = await db.subscription.findMany({
  include: { vendor: { include: { category: true } } },
})

const cycleMultiplier: Record<string, number> = {
  MONTHLY: 1, QUARTERLY: 1/3, YEARLY: 1/12, ONE_TIME: 0,
}

const portfolio = subs.map(s => ({
  id: s.id,
  vendorName: s.vendor.name,
  category: s.vendor.category?.name ?? "OTHER",
  planName: s.name,
  cost: s.cost,
  billingCycle: s.billingCycle,
  status: s.status,
  daysUntilRenewal: Math.floor((new Date(s.renewalDate).getTime() - now.getTime()) / 86400000),
  hasPaymentRecords: false,
  monthsActive: Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / (30 * 86400000)),
}))

const totalMonthlySpend = Math.round(
  portfolio
    .filter(s => ["ACTIVE", "EXPIRING_SOON"].includes(s.status))
    .reduce((sum, s) => sum + s.cost * (cycleMultiplier[s.billingCycle] ?? 0), 0)
)

const report = await analyzeSpend({ subscriptions: portfolio, totalMonthlySpend })

console.log("=== SPEND OPTIMIZATION REPORT ===")
console.log("Summary:", report.summary)
console.log("Total estimated savings:", report.totalEstimatedSavings)
console.log("\nPortfolio observations:")
report.portfolioObservations.forEach(o => console.log(" -", o))
console.log(`\nOpportunities (${report.opportunities.length} found):`)
report.opportunities
  .sort((a, b) => a.priority - b.priority)
  .forEach((o, i) => {
    console.log(`\n[${i + 1}] [${o.effort.toUpperCase()} EFFORT] ${o.title}`)
    console.log("  Type:", o.type)
    console.log("  Description:", o.description)
    if (o.estimatedSaving) console.log("  Estimated saving:", o.estimatedSaving)
    console.log("  Affects:", o.affectedSubscriptionIds.length, "subscription(s)")
  })

await db.$disconnect()
```

2. Present results clearly — group opportunities by type and effort level.

3. If there are high-priority opportunities, ask: "Want me to dig into any of these?"

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Requires database running on port 5436
- Clean up `__temp_spend.ts` after running
