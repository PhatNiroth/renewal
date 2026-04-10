import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      updateMany: vi.fn(),
      findMany:   vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationLog: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
}))

const mockDb = vi.mocked(db)
const { syncSubscriptionStatuses, runNotificationDispatcher } = await import("@/lib/notification-dispatcher")

// ─── syncSubscriptionStatuses ─────────────────────────────────────────────────

describe("syncSubscriptionStatuses()", () => {
  beforeEach(() => vi.clearAllMocks())

  it("marks past-due ACTIVE subscriptions as EXPIRED", async () => {
    await syncSubscriptionStatuses()
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "EXPIRED" },
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "EXPIRING_SOON"] },
        }),
      })
    )
  })

  it("marks subscriptions within 7 days as EXPIRING_SOON", async () => {
    await syncSubscriptionStatuses()
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "EXPIRING_SOON" },
        where: expect.objectContaining({
          status: "ACTIVE",
        }),
      })
    )
  })

  it("calls updateMany exactly twice", async () => {
    await syncSubscriptionStatuses()
    expect(mockDb.subscription.updateMany).toHaveBeenCalledTimes(2)
  })
})

// ─── runNotificationDispatcher ────────────────────────────────────────────────

describe("runNotificationDispatcher()", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns sent/skipped/errors counters", async () => {
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.user.findMany).mockResolvedValue([])
    const result = await runNotificationDispatcher()
    expect(result).toMatchObject({ sent: 0, skipped: 0, errors: 0 })
  })

  it("skips subscriptions that already have a sent notification log", async () => {
    vi.mocked(mockDb.user.findMany).mockResolvedValue([])
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([
      {
        id: "sub-1",
        vendor: { name: "Anthropic" },
        responsible: null,
        planName: "Pro",
        cost: 5000,
        renewalDate: new Date(),
        notificationLogs: [{ sentAt: new Date() }], // already sent
      },
    ] as any)

    const result = await runNotificationDispatcher()
    expect(result.skipped).toBeGreaterThan(0)
    expect(result.sent).toBe(0)
  })
})
