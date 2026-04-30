import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, DELETE } from "@/app/api/subscriptions/[id]/route"

vi.mock("@/lib/db", () => ({
  db: {
    subscription: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockFindUnique = db.subscription.findUnique as ReturnType<typeof vi.fn>
const mockDelete = db.subscription.delete as ReturnType<typeof vi.fn>

const userSession = { user: { id: "u1", email: "user@krawma.com", isAdmin: false } }
const adminSession = { user: { id: "a1", email: "admin@krawma.com", isAdmin: true } }

beforeEach(() => vi.clearAllMocks())

describe("GET /api/subscriptions/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 404 when subscription does not exist", async () => {
    mockAuth.mockResolvedValue(userSession)
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "nonexistent" }) })
    expect(res.status).toBe(404)
  })

  it("returns subscription when found", async () => {
    mockAuth.mockResolvedValue(userSession)
    const sub = { id: "s1", planName: "Figma", vendor: { name: "Figma Inc" }, responsible: null }
    mockFindUnique.mockResolvedValue(sub)
    const res = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(sub)
  })
})

describe("DELETE /api/subscriptions/[id]", () => {
  it("returns 403 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(403)
  })

  it("returns 403 when authenticated but not admin", async () => {
    mockAuth.mockResolvedValue(userSession)
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    expect(res.status).toBe(403)
  })

  it("deletes subscription and returns success for admin", async () => {
    mockAuth.mockResolvedValue(adminSession)
    mockDelete.mockResolvedValue({})
    const res = await DELETE(new Request("http://localhost"), { params: Promise.resolve({ id: "s1" }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "s1" } })
  })
})
