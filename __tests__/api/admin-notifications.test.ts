import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, PATCH } from "@/app/api/admin/notifications/route"

vi.mock("@/lib/db", () => ({
  db: {
    globalNotificationSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockFindUnique = db.globalNotificationSetting.findUnique as ReturnType<typeof vi.fn>
const mockUpsert = db.globalNotificationSetting.upsert as ReturnType<typeof vi.fn>

const userSession = { user: { id: "u1", isAdmin: false } }
const adminSession = { user: { id: "a1", isAdmin: true } }

beforeEach(() => vi.clearAllMocks())

describe("GET /api/admin/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 403 when non-admin user", async () => {
    mockAuth.mockResolvedValue(userSession)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it("returns defaults when no setting row exists", async () => {
    mockAuth.mockResolvedValue(adminSession)
    mockFindUnique.mockResolvedValue(null)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ renewal7d: true, renewal3d: true, renewal1d: true, renewalExpired: false })
  })

  it("returns stored settings when row exists", async () => {
    mockAuth.mockResolvedValue(adminSession)
    mockFindUnique.mockResolvedValue({
      id: "global",
      renewal7d: false,
      renewal3d: true,
      renewal1d: true,
      renewalExpired: true,
    })
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ renewal7d: false, renewal3d: true, renewal1d: true, renewalExpired: true })
  })
})

describe("PATCH /api/admin/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({}) })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it("returns 403 when non-admin user", async () => {
    mockAuth.mockResolvedValue(userSession)
    const req = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({}) })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it("upserts settings and returns updated row", async () => {
    mockAuth.mockResolvedValue(adminSession)
    const updated = { id: "global", renewal7d: false, renewal3d: true, renewal1d: true, renewalExpired: true }
    mockUpsert.mockResolvedValue(updated)
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ renewal7d: false, renewalExpired: true }),
    })
    const res = await PATCH(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(updated)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "global" } })
    )
  })
})
