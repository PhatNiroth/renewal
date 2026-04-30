---
name: expiry-check
description: Run the Expiry Alert agent on all active subscriptions and flag ones that need immediate attention — missing owners, overdue renewals, unrecorded payments.
---

# Expiry Check

Run the Expiry Alert agent on all subscriptions and surface risk items.

## Instructions

1. Create `__temp_expiry.ts`, run with `npx tsx __temp_expiry.ts`, then delete it:

```typescript
import { db } from "./lib/db"
import { detectExpiryRisk } from "./agents/business/expiry-alert.agent"

const now = new Date()

const subs = await db.subscription.findMany({
  include: { vendor: true },
})

const inputs = subs.map(s => ({
  subscriptionId: s.id,
  vendorName: s.vendor.name,
  planName: s.name,
  cost: s.cost,
  billingCycle: s.billingCycle,
  status: s.status,
  daysUntilRenewal: Math.floor((new Date(s.renewalDate).getTime() - now.getTime()) / 86400000),
  hasResponsible: !!s.responsibleId,
  lastPaymentDaysAgo: null,
  hasNotes: !!s.notes,
}))

const result = await detectExpiryRisk(inputs)

console.log("=== EXPIRY RISK CHECK ===")
console.log("Summary:", result.summary)
console.log(`\nRisk breakdown: ${result.criticalCount} critical, ${result.highCount} high, ${result.mediumCount} medium, ${result.lowCount} low`)

if (result.immediateActions.length > 0) {
  console.log("\n⚡ IMMEDIATE ACTIONS:")
  result.immediateActions.forEach(a => console.log(" -", a))
}

const urgent = result.items.filter(i => i.riskLevel === "critical" || i.riskLevel === "high")
if (urgent.length > 0) {
  console.log(`\n🔴 HIGH/CRITICAL ITEMS (${urgent.length}):`)
  urgent
    .sort((a, b) => a.priority - b.priority)
    .forEach(item => {
      const sub = subs.find(s => s.id === item.subscriptionId)
      console.log(`\n[${item.riskLevel.toUpperCase()}] ${sub?.vendor?.name ?? item.subscriptionId} — ${sub?.name}`)
      console.log("  Risk score:", item.riskScore + "/100")
      console.log("  Reasons:", item.reasons.join("; "))
      console.log("  Action:", item.suggestedAction)
    })
}

const medium = result.items.filter(i => i.riskLevel === "medium")
if (medium.length > 0) {
  console.log(`\n🟡 MEDIUM RISK ITEMS (${medium.length}):`)
  medium.forEach(item => {
    const sub = subs.find(s => s.id === item.subscriptionId)
    console.log(` - ${sub?.vendor?.name ?? item.subscriptionId}: ${item.suggestedAction}`)
  })
}

await db.$disconnect()
```

2. Present results — lead with critical/high items, then medium.

3. If critical items found, ask: "Want me to help action any of these?"

## Important
- Requires `ANTHROPIC_API_KEY` in `.env`
- Requires database running on port 5436
- Clean up `__temp_expiry.ts` after running
