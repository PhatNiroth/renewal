import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    payment: {
      create: vi.fn(),
      delete: vi.fn(),
    },
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

const { recordPayment, deletePayment } = await import("@/app/actions/billing")

// ─── recordPayment ────────────────────────────────────────────────────────────

describe("recordPayment", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const result = await recordPayment(new FormData())
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns Forbidden without PAYMENTS add permission", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await recordPayment(new FormData())
    expect(result).toEqual({ error: "Forbidden" })
  })

  it("returns error if subscriptionId is missing", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("amount", "100")
    fd.set("paidAt", "2026-04-09")
    const result = await recordPayment(fd)
    expect(result).toEqual({ error: "Subscription is required" })
  })

  it("returns error if amount is missing", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("subscriptionId", "sub-1")
    fd.set("paidAt", "2026-04-09")
    const result = await recordPayment(fd)
    expect(result).toEqual({ error: "Amount is required" })
  })

  it("returns error if paidAt is missing", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("subscriptionId", "sub-1")
    fd.set("amount", "100")
    const result = await recordPayment(fd)
    expect(result).toEqual({ error: "Payment date is required" })
  })

  it("returns error for invalid amount", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const fd = new FormData()
    fd.set("subscriptionId", "sub-1")
    fd.set("amount", "-50")
    fd.set("paidAt", "2026-04-09")
    const result = await recordPayment(fd)
    expect(result).toEqual({ error: "Invalid amount" })
  })

  it("records payment successfully and converts to cents", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.payment.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("subscriptionId", "sub-1")
    fd.set("amount", "49.99")
    fd.set("paidAt", "2026-04-09")
    const result = await recordPayment(fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 4999, subscriptionId: "sub-1" }),
      })
    )
  })
})

// ─── deletePayment ────────────────────────────────────────────────────────────

describe("deletePayment", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const result = await deletePayment("pay-1")
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns Forbidden without PAYMENTS delete permission", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await deletePayment("pay-1")
    expect(result).toEqual({ error: "Forbidden" })
  })

  it("deletes payment as admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.payment.delete).mockResolvedValueOnce({} as any)
    const result = await deletePayment("pay-1")
    expect(result).toEqual({ success: true })
    expect(mockDb.payment.delete).toHaveBeenCalledWith({ where: { id: "pay-1" } })
  })
})
