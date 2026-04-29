import { db } from "./db"
import { sendEmail } from "./email"
import { sendTelegramMessage } from "./telegram"
import { nextRenewalDate } from "./renewal-utils"
import { BillingCycle, NotifType, Prisma, SubscriptionStatus } from "@prisma/client"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function buildEmailHtml(headline: string, preheader: string, bodyText: string, actionItems: string[]) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin-top:0">${headline}</h2>
      <p style="color:#888;font-size:13px;margin-top:-8px">${preheader}</p>
      <div style="white-space:pre-line;line-height:1.6">${bodyText}</div>
      ${actionItems.length > 0 ? `
        <div style="margin-top:16px">
          <strong>Action items:</strong>
          <ul style="margin-top:8px;padding-left:20px">
            ${actionItems.map(item => `<li style="margin-bottom:4px">${item}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="font-size:12px;color:#aaa">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions" style="color:#888">
          View subscriptions →
        </a>
      </p>
    </div>
  `.trim()
}

// ─── Config ───────────────────────────────────────────────────────────────────

type NotifyWindow = {
  days: number
  type: NotifType
  /** User-level NotificationPref toggle. null for opt-in long-lead reminders, which are always sent when configured. */
  prefKey: "renewal7d" | "renewal3d" | "renewal1d" | null
  /** When true, only fires for subs that opted in via NotificationConfig. */
  requiresConfig: boolean
}

const NOTIFY_WINDOWS: NotifyWindow[] = [
  { days: 90, type: NotifType.RENEWAL_REMINDER_90_DAYS, prefKey: null,        requiresConfig: true  },
  { days: 30, type: NotifType.RENEWAL_REMINDER_30_DAYS, prefKey: null,        requiresConfig: true  },
  { days: 14, type: NotifType.RENEWAL_REMINDER_14_DAYS, prefKey: null,        requiresConfig: true  },
  { days: 7,  type: NotifType.RENEWAL_REMINDER_7_DAYS,  prefKey: "renewal7d", requiresConfig: false },
  { days: 3,  type: NotifType.RENEWAL_REMINDER_3_DAYS,  prefKey: "renewal3d", requiresConfig: false },
  { days: 1,  type: NotifType.RENEWAL_REMINDER_1_DAY,   prefKey: "renewal1d", requiresConfig: false },
]

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export interface DispatchResult {
  sent: number
  skipped: number
  errors: number
  telegramErrors: number
}

export async function syncSubscriptionStatuses(): Promise<void> {
  const now = new Date()
  const in7days = addDays(now, 7)

  // Auto-renewing subs with past renewalDate — advance the date instead of flipping to EXPIRED.
  // Loops until the new date is in the future (handles multi-cycle gaps if cron missed runs).
  const autoRenewing = await db.subscription.findMany({
    where: {
      autoRenew: true,
      renewalDate: { lt: now },
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRING_SOON] },
      billingCycle: { not: BillingCycle.ONE_TIME },
    },
  })

  // Use first admin as the system actor for RenewalLog entries
  const systemActor = await db.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  })

  for (const sub of autoRenewing) {
    const previousDate = sub.renewalDate
    let newDate = sub.renewalDate
    while (newDate.getTime() < now.getTime()) {
      newDate = nextRenewalDate(newDate, sub.billingCycle, sub.customDays)
    }
    await db.$transaction([
      db.subscription.update({
        where: { id: sub.id },
        data:  { renewalDate: newDate, status: SubscriptionStatus.ACTIVE },
      }),
      ...(systemActor
        ? [db.renewalLog.create({
            data: {
              subscriptionId: sub.id,
              previousDate,
              newDate,
              renewedById: systemActor.id,
            },
          })]
        : []
      ),
    ])
  }

  // Mark EXPIRED — manual subs with past renewalDate (autoRenew handled above)
  await db.subscription.updateMany({
    where: {
      autoRenew: false,
      renewalDate: { lt: now },
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRING_SOON] },
    },
    data: { status: SubscriptionStatus.EXPIRED },
  })

  // Mark EXPIRING_SOON — manual subs within 7 days; auto-renew stays ACTIVE
  await db.subscription.updateMany({
    where: {
      autoRenew: false,
      renewalDate: { gte: now, lte: in7days },
      status: SubscriptionStatus.ACTIVE,
    },
    data: { status: SubscriptionStatus.EXPIRING_SOON },
  })

  console.log(`[status-sync] Subscription statuses updated (auto-advanced: ${autoRenewing.length})`)
}

export async function runNotificationDispatcher(): Promise<DispatchResult> {
  await syncSubscriptionStatuses()
  const now = new Date()
  let sent = 0, skipped = 0, errors = 0, telegramErrors = 0

  // Global notification setting — admin controls which windows are active
  const globalSetting = await db.globalNotificationSetting.findUnique({ where: { id: "global" } })
  const globalPrefs = {
    renewal7d:      globalSetting?.renewal7d      ?? true,
    renewal3d:      globalSetting?.renewal3d      ?? true,
    renewal1d:      globalSetting?.renewal1d      ?? true,
    renewalExpired: globalSetting?.renewalExpired ?? false,
  }

  // Fallback recipients when no responsible user is assigned
  const admins = await db.user.findMany({
    where: { isAdmin: true },
    select: { id: true, name: true, email: true },
  })

  for (const { days, type, prefKey, requiresConfig } of NOTIFY_WINDOWS) {
    const targetDate = addDays(now, days)
    const from = startOfDay(targetDate)
    const to   = endOfDay(targetDate)

    const subscriptions = await db.subscription.findMany({
      where: {
        renewalDate: { gte: from, lte: to },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRING_SOON] },
        autoRenew: false,
        ...(requiresConfig ? { notificationConfigs: { some: { daysBefore: days } } } : {}),
      },
      include: {
        vendor:      { include: { category: true } },
        responsible: true,
        notificationLogs: {
          where: { type, scheduledFor: { gte: from, lte: to } },
        },
      },
    })

    for (const sub of subscriptions) {
      // Skip only if a prior attempt already succeeded for this window.
      // A row with sentAt=null is a failed/interrupted claim that we want to retry.
      const priorLog = sub.notificationLogs.find(l => l.sentAt !== null)
      if (priorLog) {
        skipped++
        continue
      }
      const staleLog = sub.notificationLogs.find(l => l.sentAt === null)

      // Build recipient list
      const recipients: { id: string; name: string; email: string }[] = []

      if (sub.responsible) {
        // Long-lead opt-in reminders (prefKey null) always fire; others check global setting.
        const enabled = prefKey === null ? true : globalPrefs[prefKey]
        if (enabled) {
          recipients.push({
            id:    sub.responsible.id,
            name:  sub.responsible.name ?? sub.responsible.email,
            email: sub.responsible.email,
          })
        }
      } else {
        // No responsible assigned — notify all admins
        recipients.push(...admins.map(a => ({
          id:    a.id,
          name:  a.name ?? a.email,
          email: a.email,
        })))
      }

      if (recipients.length === 0) {
        skipped++
        continue
      }

      // Claim the window: reuse a prior failed row if present, otherwise create a new one.
      // On unique-violation (P2002) another worker just claimed it — skip to avoid double-send.
      let log
      try {
        log = staleLog
          ? await db.notificationLog.update({
              where: { id: staleLog.id },
              data:  { recipients: recipients.map(r => ({ name: r.name, email: r.email })) },
            })
          : await db.notificationLog.create({
              data: {
                subscriptionId: sub.id,
                type,
                scheduledFor:   from,
                recipients:     recipients.map(r => ({ name: r.name, email: r.email })),
              },
            })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++
          continue
        }
        throw err
      }

      try {
        const renewalDateStr = sub.renewalDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        const costStr = `$${(sub.cost / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        const subject = `Renewal reminder: ${sub.vendor.name} — ${sub.planName} renews in ${days} day${days === 1 ? "" : "s"}`
        const headline = `${sub.vendor.name} subscription renews in ${days} day${days === 1 ? "" : "s"}`
        const preheader = `${sub.planName} · ${costStr} · Due ${renewalDateStr}`
        const bodyText = `The following subscription is coming up for renewal:\n\nVendor: ${sub.vendor.name}\nPlan: ${sub.planName}\nCost: ${costStr}\nRenewal date: ${renewalDateStr}\n\nPlease review and take action if needed.`
        const actionItems = [`Confirm renewal of ${sub.vendor.name} — ${sub.planName} by ${renewalDateStr}`]

        const html = buildEmailHtml(headline, preheader, bodyText, actionItems)

        // Send to each recipient (override to TEST_EMAIL in dev/test)
        const emailOverride = process.env.TEST_EMAIL_OVERRIDE
        for (const recipient of recipients) {
          await sendEmail(emailOverride ?? recipient.email, subject, html)
        }

        // Send to Telegram group if configured
        const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID
        if (groupChatId) {
          const telegramText = `🔔 ${headline}\n\nVendor: ${sub.vendor.name}\nPlan: ${sub.planName}\nCost: ${costStr}\nDue: ${renewalDateStr}\n\n${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscriptions`
          await sendTelegramMessage(groupChatId, telegramText).catch(err => {
            console.error(`[notifications] Telegram group failed (${type}):`, err)
            telegramErrors++
          })
        }

        // Mark log as sent
        await db.notificationLog.update({
          where: { id: log.id },
          data:  { sentAt: new Date() },
        })

        console.log(`[notifications] Sent ${type} for "${sub.vendor.name} — ${sub.planName}" to ${recipients.map(r => r.email).join(", ")}`)
        sent++
      } catch (err) {
        console.error(`[notifications] Failed for subscription ${sub.id} (${type}):`, err)
        errors++
        // sentAt stays null → will retry on next run
      }
    }
  }

  console.log(`[notifications] Done — sent: ${sent}, skipped: ${skipped}, errors: ${errors}, telegramErrors: ${telegramErrors}`)
  return { sent, skipped, errors, telegramErrors }
}
