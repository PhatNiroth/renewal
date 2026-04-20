import { BillingCycle } from "@prisma/client"

export function nextRenewalDate(current: Date, billingCycle: BillingCycle, customDays?: number | null): Date {
  const next = new Date(current)
  switch (billingCycle) {
    case BillingCycle.MONTHLY:   next.setMonth(next.getMonth() + 1); break
    case BillingCycle.QUARTERLY: next.setMonth(next.getMonth() + 3); break
    case BillingCycle.SEMESTER:  next.setMonth(next.getMonth() + 6); break
    case BillingCycle.YEARLY:    next.setFullYear(next.getFullYear() + 1); break
    case BillingCycle.CUSTOM:    next.setDate(next.getDate() + (customDays ?? 30)); break
    case BillingCycle.ONE_TIME:  break
  }
  return next
}
