import { describe, it, expect, vi, beforeEach } from "vitest"

const mockSend = vi.fn()
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockSend }
  },
}))

// Import after mock so the singleton uses our mock class
import { sendEmail, sendRenewalReminder } from "@/lib/email"

// Clear the global singleton between tests so getResend() re-instantiates
beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).resend = undefined
  process.env.EMAIL_FROM = "no-reply@krawma.com"
  process.env.RESEND_API_KEY = "test-key"
})

describe("sendEmail", () => {
  it("throws when EMAIL_FROM is not configured", async () => {
    delete process.env.EMAIL_FROM
    await expect(sendEmail("to@example.com", "Subject", "<p>body</p>")).rejects.toThrow("EMAIL_FROM is not configured")
  })

  it("calls resend with correct params", async () => {
    mockSend.mockResolvedValue({ error: null })
    await sendEmail("to@example.com", "Hello", "<p>Hi</p>")
    expect(mockSend).toHaveBeenCalledWith({
      from: "no-reply@krawma.com",
      to: "to@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
    })
  })

  it("throws when resend returns an error", async () => {
    mockSend.mockResolvedValue({ error: { message: "Invalid API key" } })
    await expect(sendEmail("to@example.com", "Subject", "<p>body</p>")).rejects.toThrow("Email send failed: Invalid API key")
  })
})

describe("sendRenewalReminder", () => {
  it("sends email with renewal details", async () => {
    mockSend.mockResolvedValue({ error: null })
    await sendRenewalReminder("user@krawma.com", "Alice", "Adobe CC", "2026-05-01", "$55.00")
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@krawma.com",
        subject: "Your Adobe CC subscription renews on 2026-05-01",
        html: expect.stringContaining("Alice"),
      })
    )
  })
})
