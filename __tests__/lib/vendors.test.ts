import { describe, it, expect, vi, beforeEach } from "vitest"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    vendor: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const mockAuth = vi.mocked(auth)
const mockDb   = vi.mocked(db)

const { createVendor, updateVendor } = await import("@/app/actions/vendors")

function adminSession() {
  return { user: { isAdmin: true, id: "admin-1", email: "admin@test.com" } } as any
}

describe("createVendor", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns error if not authorized", async () => {
    mockAuth.mockResolvedValueOnce(null as any)
    const result = await createVendor(new FormData())
    expect(result).toEqual({ error: "Unauthorized" })
  })

  it("returns error if name is missing", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    const result = await createVendor(new FormData())
    expect(result).toEqual({ error: "Vendor name is required" })
  })

  it("creates vendor successfully", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
    vi.mocked(mockDb.vendor.create).mockResolvedValueOnce({} as any)
    const fd = new FormData()
    fd.set("name", "Anthropic")
    fd.set("website", "anthropic.com")
    const result = await createVendor(fd)
    expect(result).toEqual({ success: true })
  })

  it("normalizes website URL without https://", async () => {
    mockAuth.mockResolvedValueOnce(adminSession())
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
    mockAuth.mockResolvedValueOnce(adminSession())
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
})
