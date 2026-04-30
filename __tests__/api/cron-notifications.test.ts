import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/cron/notifications/route"
import { NextRequest } from "next/server"

const mockRunDispatcher = vi.fn()
vi.mock("@/lib/notification-dispatcher", () => ({
  runNotificationDispatcher: mockRunDispatcher,
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = "test-secret"
})

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {}
  if (authHeader !== undefined) headers["authorization"] = authHeader
  return new NextRequest("http://localhost/api/cron/notifications", { headers })
}

describe("GET /api/cron/notifications", () => {
  it("returns 401 when CRON_SECRET env is not set", async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeRequest("Bearer test-secret"))
    expect(res.status).toBe(401)
  })

  it("returns 401 when authorization header is missing", async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 401 when authorization header is wrong", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"))
    expect(res.status).toBe(401)
  })

  it("runs dispatcher and returns result on valid auth", async () => {
    mockRunDispatcher.mockResolvedValue({ sent: 3, skipped: 1, errors: 0 })
    const res = await GET(makeRequest("Bearer test-secret"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, sent: 3, skipped: 1, errors: 0 })
  })

  it("returns 500 when dispatcher throws", async () => {
    mockRunDispatcher.mockRejectedValue(new Error("DB timeout"))
    const res = await GET(makeRequest("Bearer test-secret"))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("DB timeout")
  })
})
