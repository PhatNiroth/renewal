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
    globalNotificationSetting: {
      findUnique: vi.fn().mockResolvedValue({
        renewal7d: true, renewal3d: true, renewal1d: true, renewalExpired: false,
      }),
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

// Clear email override so tests assert against the real recipient
delete process.env.TEST_EMAIL_OVERRIDE

const { syncSubscriptionStatuses, runNotificationDispatcher } = await import("@/lib/notification-dispatcher")
const { sendEmail } = await import("@/lib/email")
const { sendTelegramMessage } = await import("@/lib/telegram")

function makeSub(overrides = {}) {
  return {
    id: "sub-1",
    vendor: { name: "Anthropic" },
    responsible: null,
    planName: "Pro",
    cost: 5000,
    renewalDate: new Date(),
    notificationLogs: [],
    ...overrides,
  }
}

// ─── syncSubscriptionStatuses ─────────────────────────────────────────────────

describe("syncSubscriptionStatuses()", () => {
  beforeEach(() => vi.clearAllMocks())

  it("marks past-due non-autoRenew subscriptions as EXPIRED", async () => {
    await syncSubscriptionStatuses()
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "EXPIRED" },
        where: expect.objectContaining({
          autoRenew: false,
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
          autoRenew: false,
          status: "ACTIVE",
        }),
      })
    )
  })

  it("calls updateMany exactly twice", async () => {
    await syncSubscriptionStatuses()
    expect(mockDb.subscription.updateMany).toHaveBeenCalledTimes(2)
  })

  it("auto-advances renewalDate for autoRenew=true subs past due", async () => {
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

    await syncSubscriptionStatuses()

    expect(mockDb.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-auto" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    )
    const call = vi.mocked(mockDb.subscription.update).mock.calls[0][0]
    expect((call.data.renewalDate as Date).getTime()).toBeGreaterThan(Date.now())
  })

  it("does not call update when no autoRenew subs are past due", async () => {
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([])
    await syncSubscriptionStatuses()
    expect(mockDb.subscription.update).not.toHaveBeenCalled()
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
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([
      makeSub({ notificationLogs: [{ sentAt: new Date() }] }),
    ] as any)

    const result = await runNotificationDispatcher()
    expect(result.skipped).toBeGreaterThan(0)
    expect(result.sent).toBe(0)
  })

  it("sends email to responsible user when assigned", async () => {
    const originalOverride = process.env.TEST_EMAIL_OVERRIDE
    delete process.env.TEST_EMAIL_OVERRIDE
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: { id: "user-1", name: "Jane", email: "jane@co.com" } }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.notificationLog.create).mockResolvedValueOnce({ id: "log-1" } as any)
    vi.mocked(mockDb.notificationLog.update).mockResolvedValueOnce({} as any)

    const result = await runNotificationDispatcher()
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      "jane@co.com",
      expect.any(String),
      expect.any(String)
    )
    expect(result.sent).toBe(1)
    if (originalOverride) process.env.TEST_EMAIL_OVERRIDE = originalOverride
  })

  it("falls back to all admins when no responsible user assigned", async () => {
    const originalOverride = process.env.TEST_EMAIL_OVERRIDE
    delete process.env.TEST_EMAIL_OVERRIDE
    vi.mocked(mockDb.user.findMany).mockResolvedValue([
      { id: "admin-1", name: "Admin", email: "admin@co.com" },
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: null }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.notificationLog.create).mockResolvedValueOnce({ id: "log-1" } as any)
    vi.mocked(mockDb.notificationLog.update).mockResolvedValueOnce({} as any)

    const result = await runNotificationDispatcher()
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(
      "admin@co.com",
      expect.any(String),
      expect.any(String)
    )
    expect(result.sent).toBe(1)
    if (originalOverride) process.env.TEST_EMAIL_OVERRIDE = originalOverride
  })

  it("skips when no responsible and no admins", async () => {
    vi.mocked(mockDb.user.findMany).mockResolvedValue([])
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: null }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])

    const result = await runNotificationDispatcher()
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
    expect(result.skipped).toBeGreaterThan(0)
  })

  it("stamps sentAt on notification log after successful send", async () => {
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: { id: "user-1", name: "Jane", email: "jane@co.com" } }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.notificationLog.create).mockResolvedValueOnce({ id: "log-1" } as any)
    vi.mocked(mockDb.notificationLog.update).mockResolvedValueOnce({} as any)

    await runNotificationDispatcher()

    expect(mockDb.notificationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log-1" },
        data: expect.objectContaining({ sentAt: expect.any(Date) }),
      })
    )
  })

  it("sends Telegram message when TELEGRAM_GROUP_CHAT_ID is set", async () => {
    process.env.TELEGRAM_GROUP_CHAT_ID = "-123456"
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: { id: "user-1", name: "Jane", email: "jane@co.com" } }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.notificationLog.create).mockResolvedValueOnce({ id: "log-1" } as any)
    vi.mocked(mockDb.notificationLog.update).mockResolvedValueOnce({} as any)

    await runNotificationDispatcher()

    expect(vi.mocked(sendTelegramMessage)).toHaveBeenCalledWith(
      "-123456",
      expect.any(String)
    )
    delete process.env.TELEGRAM_GROUP_CHAT_ID
  })

  it("does not send Telegram when TELEGRAM_GROUP_CHAT_ID is not set", async () => {
    delete process.env.TELEGRAM_GROUP_CHAT_ID
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: { id: "user-1", name: "Jane", email: "jane@co.com" } }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.notificationLog.create).mockResolvedValueOnce({ id: "log-1" } as any)
    vi.mocked(mockDb.notificationLog.update).mockResolvedValueOnce({} as any)

    await runNotificationDispatcher()
    expect(vi.mocked(sendTelegramMessage)).not.toHaveBeenCalled()
  })

  it("skips autoRenew=true subs from reminder emails", async () => {
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])

    await runNotificationDispatcher()

    const reminderCall = vi.mocked(mockDb.subscription.findMany).mock.calls[1]?.[0]
    expect(reminderCall).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ autoRenew: false }),
      })
    )
  })

  it("increments errors counter when email send fails", async () => {
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([]) // autoRenewing
    vi.mocked(mockDb.subscription.findMany).mockResolvedValueOnce([
      makeSub({ responsible: { id: "user-1", name: "Jane", email: "jane@co.com" } }),
    ] as any)
    vi.mocked(mockDb.subscription.findMany).mockResolvedValue([])
    vi.mocked(mockDb.notificationLog.create).mockResolvedValueOnce({ id: "log-1" } as any)
    vi.mocked(sendEmail as any).mockRejectedValueOnce(new Error("SMTP error"))

    const result = await runNotificationDispatcher()
    expect(result.errors).toBe(1)
    expect(result.sent).toBe(0)
  })
})
