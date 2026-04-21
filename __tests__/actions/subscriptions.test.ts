import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// Mock Prisma
vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      create:     vi.fn(),
      update:     vi.fn(),
      findUnique: vi.fn(),
      delete:     vi.fn(),
    },
    renewalLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const mockAuth = vi.mocked(auth)
const mockDb   = vi.mocked(db)

function adminSession() {
  return { user: { isAdmin: true, id: "admin-1", email: "admin@test.com" } } as any
}

function userSession(permissions = {}) {
  return { user: { isAdmin: false, id: "user-1", email: "user@test.com", permissions } } as any
}

// Import actions after mocks are set up
const {
  createSubscription,
  cancelSubscription,
  markAsRenewed,
  deleteSubscription,
} = await import("@/app/actions/subscriptions")

// ─── createSubscription ───────────────────────────────────────────────────────

describe("createSubscription", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const fd = new FormData()
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns Forbidden if user lacks permission", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await createSubscription(new FormData())
    expect(result).toEqual({ error: "Forbidden" })
  })

  it("returns error if vendorId is missing", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("planName", "Pro")
    fd.set("cost", "100")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2027-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Vendor is required" })
  })

  it("returns error for invalid cost", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Pro")
    fd.set("cost", "abc")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2027-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Invalid cost amount" })
  })

  it("returns error for CUSTOM cycle without customDays", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Pro")
    fd.set("cost", "100")
    fd.set("billingCycle", "CUSTOM")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2027-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Custom duration (days) is required" })
  })

  it("creates subscription successfully as admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Pro")
    fd.set("cost", "500")
    fd.set("billingCycle", "MONTHLY")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2026-02-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cost: 50000, billingCycle: "MONTHLY" }),
      })
    )
  })
})

// ─── cancelSubscription ───────────────────────────────────────────────────────

describe("cancelSubscription", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await cancelSubscription("sub-1")
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("cancels subscription as admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    const result = await cancelSubscription("sub-1")
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data:  { status: "CANCELLED" },
    })
  })
})

// ─── markAsRenewed ────────────────────────────────────────────────────────────

describe("markAsRenewed", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns Forbidden without RENEWALS edit permission", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ error: "Forbidden" })
  })

  it("returns error if subscription not found", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce(null)
    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ error: "Subscription not found" })
  })

  it("advances renewalDate by 1 month for MONTHLY subscription", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "MONTHLY", customDays: null,
      renewalDate: new Date("2026-04-09"),
    } as any)
    vi.mocked(mockDb.$transaction).mockResolvedValueOnce([{}, {}] as any)

    const result = await markAsRenewed("sub-1")
    expect(result).toEqual({ success: true })

    const updateCall = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    const newDate = updateCall.data.renewalDate as Date
    expect(newDate.getFullYear()).toBe(2026)
    expect(newDate.getMonth()).toBe(4) // May (0-indexed)
  })

  it("advances renewalDate by 1 year for YEARLY subscription", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "YEARLY", customDays: null,
      renewalDate: new Date("2026-04-09"),
    } as any)
    vi.mocked(mockDb.$transaction).mockResolvedValueOnce([{}, {}] as any)

    await markAsRenewed("sub-1")
    const updateCall = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    const newDate = updateCall.data.renewalDate as Date
    expect(newDate.getFullYear()).toBe(2027)
  })

  it("advances renewalDate by customDays for CUSTOM subscription", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "CUSTOM", customDays: 90,
      renewalDate: new Date("2027-04-09"),
    } as any)
    vi.mocked(mockDb.$transaction).mockResolvedValueOnce([{}, {}] as any)

    await markAsRenewed("sub-1")
    const updateCall = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    const newDate = updateCall.data.renewalDate as Date
    const expected = new Date("2027-04-09")
    expected.setDate(expected.getDate() + 90)
    expect(newDate.toDateString()).toBe(expected.toDateString())
  })

  it("does not change renewalDate for ONE_TIME subscription", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const originalDate = new Date("2026-04-09")
    vi.mocked(mockDb.subscription.findUnique).mockResolvedValueOnce({
      id: "sub-1", billingCycle: "ONE_TIME", customDays: null,
      renewalDate: originalDate,
    } as any)
    vi.mocked(mockDb.$transaction).mockResolvedValueOnce([{}, {}] as any)

    await markAsRenewed("sub-1")
    const updateCall = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    expect(updateCall.data.renewalDate).toEqual(originalDate)
  })
})

// ─── deleteSubscription ───────────────────────────────────────────────────────

describe("deleteSubscription", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Forbidden for non-admin without delete permission", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await deleteSubscription("sub-1")
    expect(result).toEqual({ error: "Forbidden" })
  })

  it("deletes subscription as admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.delete).mockResolvedValueOnce({} as any)
    const result = await deleteSubscription("sub-1")
    expect(result).toEqual({ success: true })
  })
})
