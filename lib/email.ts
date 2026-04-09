import { Resend } from "resend"

const globalForResend = globalThis as unknown as { resend: Resend | undefined }

const resend =
  globalForResend.resend ?? new Resend(process.env.RESEND_API_KEY!)

if (process.env.NODE_ENV !== "production") globalForResend.resend = resend

const FROM = process.env.EMAIL_FROM ?? "noreply@subtrack.app"

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const { error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(`Email send failed: ${error.message}`)
}

export async function sendRenewalReminder(
  to: string,
  userName: string,
  planName: string,
  renewalDate: string,
  amount: string
): Promise<void> {
  await sendEmail(
    to,
    `Your ${planName} subscription renews on ${renewalDate}`,
    `<p>Hi ${userName},</p>
     <p>Your <strong>${planName}</strong> subscription will renew on <strong>${renewalDate}</strong> for <strong>${amount}</strong>.</p>
     <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing">Manage your subscription</a></p>`
  )
}
