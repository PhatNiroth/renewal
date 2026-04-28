import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    subscription: {
      updateMany: vi.fn(),
      update:     vi.fn().mockResolvedValue({}),
      findMany:   vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany:  vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: "system-admin-id" }),
    },
    renewalLog: {
      create: vi.fn(),
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
    // First findMany call is autoRenewing query — return empty so it's a no-op
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([])
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

  it("auto-advances renewalDate for autoRenew=true subs instead of expiring", async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5)

    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      {
        id: "sub-auto",
        autoRenew: true,
        billingCycle: "MONTHLY",
        customDays: null,
        renewalDate: pastDate,
        status: "ACTIVE",
      },
    ] as any)
    vi.mocked(mockDb.user.findMany).mockResolvedValue([])

    await runNotificationDispatcher()

    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-auto" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    )
    const call = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    const newDate = call.data.renewalDate as Date
    expect(newDate.getTime()).toBeGreaterThan(Date.now())
  })

  it("skips autoRenew=true subs from reminder emails", async () => {
    // autoRenewing call returns empty (no past-due)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([])
    // Reminder queries return empty because autoRenew:false filter excludes them
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])

    await runNotificationDispatcher()

    const reminderCall = vi.mocked(mockDb.subscription.findMany).mock.calls[1]?.[0]
    expect(reminderCall).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ autoRenew: false }),
      })
    )
  })
})
