import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/health/route"

vi.mock("@/lib/db", () => ({
  db: { user: { count: vi.fn() } },
}))

import { db } from "@/lib/db"
const mockCount = db.user.count as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe("GET /api/health", () => {
  it("returns ok when database is reachable", async () => {
    mockCount.mockResolvedValue(42)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ status: "ok", database: "connected", users: 42 })
  })

  it("returns 500 when database throws", async () => {
    mockCount.mockRejectedValue(new Error("connection refused"))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.status).toBe("error")
    expect(body.database).toBe("failed")
    expect(body.error).toBe("connection refused")
  })
})
