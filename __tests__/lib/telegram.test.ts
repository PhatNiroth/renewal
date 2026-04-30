import { describe, it, expect, vi, beforeEach } from "vitest"
import { sendTelegramMessage } from "@/lib/telegram"

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TELEGRAM_BOT_TOKEN = "test-bot-token"
})

describe("sendTelegramMessage", () => {
  it("throws when TELEGRAM_BOT_TOKEN is not set", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    await expect(sendTelegramMessage("123", "hello")).rejects.toThrow("TELEGRAM_BOT_TOKEN is not set")
  })

  it("sends message to correct Telegram API endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await sendTelegramMessage("-1001234567", "Renewal alert")
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001234567", text: "Renewal alert" }),
      })
    )
  })

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ description: "Bad Request" }),
    })
    await expect(sendTelegramMessage("123", "msg")).rejects.toThrow("Telegram API error 400")
  })

  it("handles json parse failure gracefully in error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("not json") },
    })
    await expect(sendTelegramMessage("123", "msg")).rejects.toThrow("Telegram API error 500")
  })
})
