import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/subscriptions/[id]/history/route"

vi.mock("@/lib/db", () => ({
  db: {
    subscription: { findUnique: vi.fn() },
    renewalLog: { findMany: vi.fn() },
  },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockSubFind = db.subscription.findUnique as ReturnType<typeof vi.fn>
const mockLogFind = db.renewalLog.findMany as ReturnType<typeof vi.fn>

const session = { user: { id: "u1", email: "user@krawma.com" } }

beforeEach(() => vi.clearAllMocks())

describe("GET /api/subscriptions/[id]/history", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 404 when subscription does not exist", async () => {
    mockAuth.mockResolvedValue(session)
    mockSubFind.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "bad-id" }) })
    expect(res.status).toBe(404)
  })

  it("returns serialized renewal logs with ISO dates", async () => {
    mockAuth.mockResolvedValue(session)
    mockSubFind.mockResolvedValue({ id: "s1" })
    const prev = new Date("2025-01-01T00:00:00Z")
    const next = new Date("2026-01-01T00:00:00Z")
    const created = new Date("2025-01-01T09:00:00Z")
    mockLogFind.mockResolvedValue([
      {
        id: "log1",
        previousDate: prev,
        newDate: next,
        createdAt: created,
        notes: null,
        renewedBy: { name: "Alice", email: "alice@krawma.com" },
      },
    ])
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].previousDate).toBe(prev.toISOString())
    expect(body[0].newDate).toBe(next.toISOString())
    expect(body[0].isAuto).toBe(false)
    expect(body[0].renewedBy).toEqual({ name: "Alice", email: "alice@krawma.com" })
  })

  it("marks log as auto when notes === 'auto'", async () => {
    mockAuth.mockResolvedValue(session)
    mockSubFind.mockResolvedValue({ id: "s1" })
    mockLogFind.mockResolvedValue([
      {
        id: "log2",
        previousDate: new Date(),
        newDate: new Date(),
        createdAt: new Date(),
        notes: "auto",
        renewedBy: { name: "System", email: "system@krawma.com" },
      },
    ])
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    const body = await res.json()
    expect(body[0].isAuto).toBe(true)
  })

  it("returns empty array when no history exists", async () => {
    mockAuth.mockResolvedValue(session)
    mockSubFind.mockResolvedValue({ id: "s1" })
    mockLogFind.mockResolvedValue([])
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })
})
