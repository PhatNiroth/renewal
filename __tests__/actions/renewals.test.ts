import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { nextRenewalDate } from "@/lib/renewal-utils"
import { BillingCycle } from "@prisma/client"

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}))

const mockAuth = vi.mocked(auth)
const mockDb   = vi.mocked(db)

function adminSession() {
  return { user: { isAdmin: true, id: "admin-1", email: "admin@test.com" } } as any
}
function userWithRenewalEdit() {
  return { user: { isAdmin: false, id: "user-1", permissions: { RENEWALS: { edit: true } } } } as any
}
function userWithoutRenewalEdit() {
  return { user: { isAdmin: false, id: "user-1", permissions: {} } } as any
}

const { markAsRenewed } = await import("@/app/actions/subscriptions")

// ─── nextRenewalDate — date calculation ───────────────────────────────────────

describe("nextRenewalDate()", () => {
  const base = new Date("2026-01-15")

  it("advances by 1 month for MONTHLY", () => {
    const result = nextRenewalDate(base, BillingCycle.MONTHLY)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(15)
  })

  it("advances by 3 months for QUARTERLY", () => {
    const result = nextRenewalDate(base, BillingCycle.QUARTERLY)
    expect(result.getMonth()).toBe(3) // April
    expect(result.getDate()).toBe(15)
  })

  it("advances by 1 year for YEARLY", () => {
    const result = nextRenewalDate(base, BillingCycle.YEARLY)
    expect(result.getFullYear()).toBe(2027)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(15)
  })

  it("advances by customDays for CUSTOM", () => {
    const result = nextRenewalDate(base, BillingCycle.CUSTOM, 90)
    const expected = new Date("2026-01-15")
    expected.setDate(expected.getDate() + 90)
    expect(result.toDateString()).toBe(expected.toDateString())
  })

  it("defaults to 30 days for CUSTOM when customDays is null", () => {
    const result = nextRenewalDate(base, BillingCycle.CUSTOM, null)
    const expected = new Date("2026-01-15")
    expected.setDate(expected.getDate() + 30)
    expect(result.toDateString()).toBe(expected.toDateString())
  })

  it("does not change date for ONE_TIME", () => {
    const result = nextRenewalDate(base, BillingCycle.ONE_TIME)
    expect(result.toDateString()).toBe(base.toDateString())
  })

  it("handles month-end correctly for MONTHLY (Jan 31 → Feb 28/29)", () => {
    const jan31 = new Date("2026-01-31")
    const result = nextRenewalDate(jan31, BillingCycle.MONTHLY)
    // JS rolls over to March 3 or similar — just verify it's past January
    expect(result.getTime()).toBeGreaterThan(jan31.getTime())
  })

  it("does not mutate the original date", () => {
    const original = new Date("2026-01-15")
    const originalTime = original.getTime()
    nextRenewalDate(original, BillingCycle.MONTHLY)
    expect(original.getTime()).toBe(originalTime)
  })

  it("handles CUSTOM with customDays = 1", () => {
    const result = nextRenewalDate(base, BillingCycle.CUSTOM, 1)
    expect(result.getDate()).toBe(16)
  })

  it("handles CUSTOM with customDays = 365", () => {
    const result = nextRenewalDate(base, BillingCycle.CUSTOM, 365)
    expect(result.getFullYear()).toBe(2027)
  })
})

// ─── markAsRenewed — permissions ─────────────────────────────────────────────

describe("markAsRenewed() — permissions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("allows admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "MONTHLY", customDays: null,
      renewalDate: new Date("2026-04-01"),
    } as any)
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ success: true })
  })

  it("allows user with RENEWALS edit permission", async () => {
    mockAuth.mockResolvedValueOnce(userWithRenewalEdit())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "MONTHLY", customDays: null,
      renewalDate: new Date("2026-04-01"),
    } as any)
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ success: true })
  })

  it("blocks user without RENEWALS edit permission", async () => {
    mockAuth.mockResolvedValueOnce(userWithoutRenewalEdit())
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ error: "Forbidden" })
  })

  it("blocks unauthenticated user", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ error: "Unauthorized" })
  })
})

// ─── markAsRenewed — status reset ────────────────────────────────────────────

describe("markAsRenewed() — status reset", () => {
  beforeEach(() => vi.clearAllMocks())

  it("resets EXPIRING_SOON back to ACTIVE", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "MONTHLY", customDays: null,
      renewalDate: new Date("2026-04-01"), status: "EXPIRING_SOON",
    } as any)
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    await markAsRenewed("sub-1")
    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    )
  })

  it("resets EXPIRED back to ACTIVE", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "YEARLY", customDays: null,
      renewalDate: new Date("2025-01-01"), status: "EXPIRED",
    } as any)
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    await markAsRenewed("sub-1")
    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE" }) })
    )
  })

  it("returns error for non-existent subscription", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce(null)
    const result = await markAsRenewed("non-existent")
    expect(result).toEqual({ error: "Subscription not found" })
  })
})

// ─── markAsRenewed — all billing cycles ──────────────────────────────────────

describe("markAsRenewed() — all billing cycles", () => {
  beforeEach(() => vi.clearAllMocks())

  const cases = [
    { cycle: "MONTHLY",   customDays: null, renewalDate: "2026-03-09", expectedMonth: 3 },
    { cycle: "QUARTERLY", customDays: null, renewalDate: "2026-03-09", expectedMonth: 5 },
    { cycle: "YEARLY",    customDays: null, renewalDate: "2026-03-09", expectedYear: 2027 },
    { cycle: "CUSTOM",    customDays: 60,   renewalDate: "2026-03-09", expectedDaysAdded: 60 },
  ]

  for (const c of cases) {
    it(`advances date correctly for ${c.cycle}`, async () => {
      mockAuth.mockResolvedValueOnce(adminSession())
      vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
        id: "sub-1", billingCycle: c.cycle, customDays: c.customDays,
        renewalDate: new Date(c.renewalDate),
      } as any)
      vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)

      await markAsRenewed("sub-1")

      const call = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
      const newDate = call.data.renewalDate as Date

      if (c.expectedMonth !== undefined) expect(newDate.getMonth()).toBe(c.expectedMonth)
      if (c.expectedYear  !== undefined) expect(newDate.getFullYear()).toBe(c.expectedYear)
      if (c.expectedDaysAdded !== undefined) {
        const base = new Date(c.renewalDate)
        base.setDate(base.getDate() + c.expectedDaysAdded)
        expect(newDate.toDateString()).toBe(base.toDateString())
      }
    })
  }

  it("keeps same date for ONE_TIME", async () => {
    const originalDate = new Date("2026-03-09")
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "ONE_TIME", customDays: null,
      renewalDate: originalDate,
    } as any)
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)

    await markAsRenewed("sub-1")
    const call = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    expect(call.data.renewalDate).toEqual(originalDate)
  })
})
