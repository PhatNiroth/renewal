import { describe, it, expect, vi, beforeEach } from "vitest"
import { requireAdmin } from "@/lib/permissions"

import { auth } from "@/lib/auth"
const mockAuth = auth as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe("requireAdmin", () => {
  it("returns error 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const result = await requireAdmin()
    expect(result.error).toBeDefined()
    const res = result.error as Response
    expect(res.status).toBe(401)
  })

  it("returns error 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", isAdmin: false } })
    const result = await requireAdmin()
    expect(result.error).toBeDefined()
    const res = result.error as Response
    expect(res.status).toBe(403)
  })

  it("returns session when user is admin", async () => {
    const session = { user: { id: "a1", isAdmin: true } }
    mockAuth.mockResolvedValue(session)
    const result = await requireAdmin()
    expect(result.error).toBeUndefined()
    expect((result as any).session).toEqual(session)
  })
})
