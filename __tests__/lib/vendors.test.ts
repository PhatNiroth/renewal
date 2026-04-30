import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    vendor: {
      create:    vi.fn(),
      update:    vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

const mockAuth = vi.mocked(auth)
const mockDb   = vi.mocked(db)

const { createVendor, updateVendor, deactivateVendor } = await import("@/app/actions/vendors")

function adminSession() {
  return { user: { isAdmin: true, id: "admin-1", email: "admin@test.com" } } as any
}
function userSession() {
  return { user: { isAdmin: false, id: "user-1", email: "user@test.com" } } as any
}

// ─── createVendor ─────────────────────────────────────────────────────────────

describe("createVendor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockDb.vendor.findFirst).mockResolvedValue(null)
  })

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await createVendor(new FormData())
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error if name is missing", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await createVendor(new FormData())
    expect(result).toEqual({ error: "Vendor name is required" })
  })

  it("creates vendor successfully as regular user", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Anthropic")
    const result = await createVendor(fd)
    expect(result).toEqual({ success: true })
  })

  it("creates vendor successfully as admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Anthropic")
    const result = await createVendor(fd)
    expect(result).toEqual({ success: true })
  })

  it("normalizes website URL without https://", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "BongThom")
    fd.set("website", "www.bongthom.com")
    await createVendor(fd)
    expect(mockDb.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ website: "https://www.bongthom.com" }),
      })
    )
  })

  it("keeps website URL that already has https://", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "GitHub")
    fd.set("website", "https://github.com")
    await createVendor(fd)
    expect(mockDb.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ website: "https://github.com" }),
      })
    )
  })

  it("sets null website when website is empty", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Local Vendor")
    fd.set("website", "")
    await createVendor(fd)
    expect(mockDb.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ website: null }),
      })
    )
  })

  it("generates slug from name", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Google Workspace")
    await createVendor(fd)
    expect(mockDb.vendor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "google-workspace" }),
      })
    )
  })

  it("returns friendly error on duplicate name", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.findFirst).mockResolvedValueOnce({ id: "existing-vendor" } as any)
    const fd = new FormData()
    fd.set("name", "Anthropic")
    const result = await createVendor(fd)
    expect(result).toEqual({ error: `A vendor named "Anthropic" already exists` })
  })
})

// ─── updateVendor ─────────────────────────────────────────────────────────────

describe("updateVendor", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await updateVendor("vendor-1", new FormData())
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("updates vendor successfully", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.update).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Anthropic Updated")
    fd.set("contactEmail", "new@anthropic.com")
    const result = await updateVendor("vendor-1", fd)
    expect(result).toEqual({ success: true })
    expect(mockDb.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vendor-1" },
        data: expect.objectContaining({
          name: "Anthropic Updated",
          slug: "anthropic-updated",
          contactEmail: "new@anthropic.com",
        }),
      })
    )
  })

  it("normalizes website on update", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.update).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Vendor")
    fd.set("website", "vendor.com")
    await updateVendor("vendor-1", fd)
    expect(mockDb.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ website: "https://vendor.com" }),
      })
    )
  })

  it("allows regular user to update", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    vi.mocked(mockDb.vendor.update).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Vendor")
    const result = await updateVendor("vendor-1", fd)
    expect(result).toEqual({ success: true })
  })
})

// ─── deactivateVendor ─────────────────────────────────────────────────────────

describe("deactivateVendor", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns Unauthorized if not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await deactivateVendor("vendor-1")
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("blocks regular user", async () => {
    mockAuth.mockResolvedValueOnce(userSession())
    const result = await deactivateVendor("vendor-1")
    expect(result).toEqual({ error: "Forbidden — Admin only" })
    expect(mockDb.vendor.update).not.toHaveBeenCalled()
  })

  it("deactivates vendor as admin", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.vendor.update).mockResolvedValueOnce({} as any)
    const result = await deactivateVendor("vendor-1")
    expect(result).toEqual({ success: true })
    expect(mockDb.vendor.update).toHaveBeenCalledWith({
      where: { id: "vendor-1" },
      data:  { isActive: false },
    })
  })
})
