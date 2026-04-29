import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      create:     vi.fn(),
      update:     vi.fn(),
      findUnique: vi.fn(),
      delete:     vi.fn(),
    },
    notificationConfig: {
      deleteMany:  vi.fn(),
      createMany:  vi.fn(),
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
function userSession() {
  return { user: { isAdmin: false, id: "user-1", email: "user@test.com" } } as any
}

const {
  createSubscription,
  updateSubscription,
  cancelSubscription,
  deleteSubscription,
} = await import("@/app/actions/subscriptions")

// ─── createSubscription ───────────────────────────────────────────────────────

describe("createSubscription", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await createSubscription(new FormData())
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error if vendorId is missing", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const fd = new FormData()
    fd.set("planName", "Pro")
    fd.set("cost", "100")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2027-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Vendor is required" })
  })

  it("returns error if planName is missing", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("cost", "100")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2027-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Plan / service name is required" })
  })

  it("returns error if startDate is missing", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Pro")
    fd.set("cost", "100")
    fd.set("renewalDate", "2027-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Start date is required" })
  })

  it("returns error if renewalDate is before startDate", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Pro")
    fd.set("cost", "100")
    fd.set("startDate", "2026-06-01")
    fd.set("renewalDate", "2026-01-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Renewal date must be after start date" })
  })

  it("returns error for invalid cost", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
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
    mockAuth.mockResolvedValueOnce(userSession())
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

  it("returns error if cardLast4 is not exactly 4 digits", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Visa Card")
    fd.set("kind", "CARD")
    fd.set("cost", "100")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2027-01-01")
    fd.set("cardBrand", "VISA")
    fd.set("cardLast4", "12")
    const result = await createSubscription(fd)
    expect(result).toEqual({ error: "Card last 4 must be exactly 4 digits" })
  })

  it("creates subscription successfully and converts cost to cents", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.subscription.create).mockResolvedValueOnce({ id: "new-sub" } as any)
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

  it("allows any logged-in user to create a subscription", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.subscription.create).mockResolvedValueOnce({ id: "new-sub" } as any)
    const fd = new FormData()
    fd.set("vendorId", "vendor-1")
    fd.set("planName", "Pro")
    fd.set("cost", "100")
    fd.set("startDate", "2026-01-01")
    fd.set("renewalDate", "2026-02-01")
    const result = await createSubscription(fd)
    expect(result).toEqual({ success: true })
  })
})

// ─── updateSubscription ───────────────────────────────────────────────────────

describe("updateSubscription", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await updateSubscription("sub-1", { planName: "New Name" })
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error if renewalDate is before startDate", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await updateSubscription("sub-1", {
      startDate: new Date("2026-06-01"),
      renewalDate: new Date("2026-01-01"),
    })
    expect(result).toEqual({ error: "Renewal date must be after start date" })
  })

  it("returns error if cardLast4 is not exactly 4 digits", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await updateSubscription("sub-1", { cardLast4: "12AB" })
    expect(result).toEqual({ error: "Card last 4 must be exactly 4 digits" })
  })

  it("updates subscription successfully", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    const result = await updateSubscription("sub-1", { planName: "Enterprise", cost: 99900 })
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ planName: "Enterprise", cost: 99900 }),
      })
    )
  })

  it("syncs extra reminders when provided", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    vi.mocked(mockDb.notificationConfig.deleteMany).mockResolvedValueOnce({} as any)
    vi.mocked(mockDb.notificationConfig.createMany).mockResolvedValueOnce({} as any)
    const result = await updateSubscription("sub-1", { extraReminders: [30, 90] })
    expect(result).toEqual({ success: true })
    expect(mockDb.notificationConfig.deleteMany).toHaveBeenCalled()
    expect(mockDb.notificationConfig.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ subscriptionId: "sub-1", daysBefore: 30 }),
          expect.objectContaining({ subscriptionId: "sub-1", daysBefore: 90 }),
        ]),
      })
    )
  })

  it("allows any logged-in user to update", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    const result = await updateSubscription("sub-1", { notes: "Updated note" })
    expect(result).toEqual({ success: true })
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

  it("cancels subscription as any logged-in user", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.subscription.update).mockResolvedValueOnce({} as any)
    const result = await cancelSubscription("sub-1")
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data:  { status: "CANCELLED" },
    })
  })
})

// ─── deleteSubscription ───────────────────────────────────────────────────────

describe("deleteSubscription", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await deleteSubscription("sub-1")
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("deletes subscription as any logged-in user", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.subscription.delete).mockResolvedValueOnce({} as any)
    const result = await deleteSubscription("sub-1")
    expect(result).toEqual({ success: true })
    expect(mockDb.subscription.delete).toHaveBeenCalledWith({ where: { id: "sub-1" } })
  })
})
