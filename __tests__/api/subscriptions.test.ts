import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/subscriptions/route"

vi.mock("@/lib/db", () => ({
  db: { subscription: { findMany: vi.fn() } },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockFindMany = db.subscription.findMany as ReturnType<typeof vi.fn>

const session = { user: { id: "u1", email: "user@krawma.com", isAdmin: false } }

beforeEach(() => vi.clearAllMocks())

describe("GET /api/subscriptions", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns subscription list ordered by renewalDate", async () => {
    mockAuth.mockResolvedValue(session)
    const subs = [
      { id: "s1", planName: "Adobe CC", vendor: { name: "Adobe" }, responsible: null },
      { id: "s2", planName: "Slack", vendor: { name: "Slack" }, responsible: null },
    ]
    mockFindMany.mockResolvedValue(subs)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(subs)
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { renewalDate: "asc" } })
    )
  })

  it("returns empty array when no subscriptions exist", async () => {
    mockAuth.mockResolvedValue(session)
    mockFindMany.mockResolvedValue([])
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })
})
