import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "@/app/api/vendor-categories/route"

vi.mock("@/lib/db", () => ({
  db: {
    vendorCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/category-colors", () => ({
  pickAutoColor: vi.fn().mockReturnValue("#3b82f6"),
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
const mockAuth = auth as ReturnType<typeof vi.fn>
const mockFindMany = db.vendorCategory.findMany as ReturnType<typeof vi.fn>
const mockFindFirst = db.vendorCategory.findFirst as ReturnType<typeof vi.fn>
const mockCount = db.vendorCategory.count as ReturnType<typeof vi.fn>
const mockCreate = db.vendorCategory.create as ReturnType<typeof vi.fn>

const session = { user: { id: "u1", email: "user@krawma.com", isAdmin: false } }

beforeEach(() => vi.clearAllMocks())

describe("GET /api/vendor-categories", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns category list for authenticated user", async () => {
    mockAuth.mockResolvedValue(session)
    const cats = [{ id: "c1", name: "SaaS", slug: "saas", _count: { vendors: 3 } }]
    mockFindMany.mockResolvedValue(cats)
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(cats)
  })
})

describe("POST /api/vendor-categories", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "SaaS" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue(session)
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns existing category when name already exists (idempotent)", async () => {
    mockAuth.mockResolvedValue(session)
    const existing = { id: "c1", name: "SaaS", slug: "saas", _count: { vendors: 1 } }
    mockFindFirst.mockResolvedValue(existing)
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "SaaS" }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(existing)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("creates and returns new category with status 201", async () => {
    mockAuth.mockResolvedValue(session)
    mockFindFirst.mockResolvedValue(null)
    mockCount.mockResolvedValue(2)
    const created = { id: "c2", name: "Hardware", slug: "hardware", color: "#3b82f6", _count: { vendors: 0 } }
    mockCreate.mockResolvedValue(created)
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "Hardware" }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body).toEqual(created)
  })

  it("auto-generates slug from name", async () => {
    mockAuth.mockResolvedValue(session)
    mockFindFirst.mockResolvedValue(null)
    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValue({ id: "c3", name: "Cloud Services", slug: "cloud-services", _count: { vendors: 0 } })
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "Cloud Services" }),
    })
    await POST(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "cloud-services" }) })
    )
  })

  it("uses provided color over auto-color", async () => {
    mockAuth.mockResolvedValue(session)
    mockFindFirst.mockResolvedValue(null)
    mockCount.mockResolvedValue(0)
    mockCreate.mockResolvedValue({ id: "c4", name: "Finance", slug: "finance", color: "#ff0000", _count: { vendors: 0 } })
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "Finance", color: "#ff0000" }),
    })
    await POST(req)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ color: "#ff0000" }) })
    )
  })

  it("returns 409 on database unique constraint error", async () => {
    mockAuth.mockResolvedValue(session)
    mockFindFirst.mockResolvedValue(null)
    mockCount.mockResolvedValue(0)
    mockCreate.mockRejectedValue(new Error("Unique constraint failed"))
    const req = new Request("http://localhost/api/vendor-categories", {
      method: "POST",
      body: JSON.stringify({ name: "Finance" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })
})
